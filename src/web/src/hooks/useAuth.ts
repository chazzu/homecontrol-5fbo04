import { useContext, useCallback, useEffect, useRef } from 'react'; // v18.0.0
import { AuthContext } from '../contexts/AuthContext';
import { AuthContextType, UserRole } from '../types/auth.types';
import { ERROR_CODES, AUTH_TIMEOUT } from '../config/constants';

/**
 * Enhanced custom hook for managing authentication state and operations
 * Implements secure token-based authentication with comprehensive session monitoring
 * @returns {AuthContextType} Authentication context with enhanced security features
 * @throws {Error} If used outside of AuthProvider context
 */
export const useAuth = (): AuthContextType => {
  // Get authentication context with validation
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { state, login, logout, refreshToken } = context;
  const failedAttemptsRef = useRef<number>(0);
  const lastAttemptRef = useRef<number>(0);

  /**
   * Enhanced login handler with rate limiting and security monitoring
   */
  const handleLogin = useCallback(async (token: string): Promise<void> => {
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - lastAttemptRef.current < AUTH_TIMEOUT) {
        failedAttemptsRef.current++;
        if (failedAttemptsRef.current >= 5) {
          throw new Error(`Too many login attempts. Please wait ${AUTH_TIMEOUT / 1000} seconds.`);
        }
      } else {
        failedAttemptsRef.current = 0;
      }
      lastAttemptRef.current = now;

      // Validate token format
      if (!token?.trim() || !/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(token)) {
        throw new Error(ERROR_CODES.AUTH.INVALID_TOKEN);
      }

      await login(token);
      failedAttemptsRef.current = 0;
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }, [login]);

  /**
   * Enhanced logout handler with secure cleanup
   */
  const handleLogout = useCallback((): void => {
    try {
      logout();
      failedAttemptsRef.current = 0;
      lastAttemptRef.current = 0;
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if error occurs
      logout();
    }
  }, [logout]);

  /**
   * Permission checker for role-based access control
   */
  const checkPermission = useCallback((requiredRole: UserRole): boolean => {
    const roleHierarchy = {
      [UserRole.ADMIN]: 3,
      [UserRole.USER]: 2,
      [UserRole.GUEST]: 1
    };

    return roleHierarchy[state.role] >= roleHierarchy[requiredRole];
  }, [state.role]);

  /**
   * Session activity monitor
   */
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const handleActivity = (): void => {
      if (state.sessionExpiry && Date.now() >= state.sessionExpiry) {
        handleLogout();
        return;
      }
    };

    // Monitor user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Setup token refresh before expiry
    const tokenRefreshInterval = setInterval(() => {
      if (state.isAuthenticated) {
        refreshToken().catch((error) => {
          console.error('Token refresh failed:', error);
          handleLogout();
        });
      }
    }, 4 * 60 * 1000); // Refresh token every 4 minutes

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(tokenRefreshInterval);
    };
  }, [state.isAuthenticated, state.sessionExpiry, refreshToken, handleLogout]);

  /**
   * Security event logger
   */
  useEffect(() => {
    const logSecurityEvent = (event: string, details: Record<string, unknown>): void => {
      console.info(`Security Event: ${event}`, {
        timestamp: new Date().toISOString(),
        ...details
      });
    };

    if (state.isAuthenticated) {
      logSecurityEvent('Session Started', {
        role: state.role,
        expiry: state.sessionExpiry
      });
    }

    return () => {
      if (state.isAuthenticated) {
        logSecurityEvent('Session Ended', {
          role: state.role
        });
      }
    };
  }, [state.isAuthenticated, state.role, state.sessionExpiry]);

  return {
    state,
    login: handleLogin,
    logout: handleLogout,
    refreshToken,
    checkPermission
  };
};

export default useAuth;
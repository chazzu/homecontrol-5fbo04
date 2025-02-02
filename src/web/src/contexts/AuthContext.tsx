import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react'; // v18.0.0
import { AuthState, AuthContextType } from '../types/auth.types';
import { AuthService } from '../services/auth';
import { storageService } from '../services/storage';
import { AUTH_TOKEN_KEY, AUTH_TIMEOUT, ERROR_CODES } from '../config/constants';

/**
 * Initial authentication state with secure defaults
 */
const initialAuthState: AuthState = {
  isAuthenticated: false,
  token: null,
  role: 'GUEST',
  lastActivity: 0,
  sessionExpiry: 0
};

/**
 * Context for managing authentication state and operations
 * Implements comprehensive security measures and session management
 */
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Props interface for AuthProvider component
 */
interface AuthProviderProps {
  children: ReactNode;
  sessionTimeout?: number;
  tokenRefreshInterval?: number;
}

/**
 * Authentication Provider component implementing secure authentication management
 * Handles token lifecycle, session monitoring, and role-based access control
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  sessionTimeout = AUTH_TIMEOUT,
  tokenRefreshInterval = 300000 // 5 minutes
}) => {
  // Core state management
  const [state, setState] = useState<AuthState>(initialAuthState);
  const authService = useRef(new AuthService(storageService));
  const activityTimeout = useRef<NodeJS.Timeout>();
  const refreshInterval = useRef<NodeJS.Timeout>();

  /**
   * Securely handles user login with comprehensive validation
   */
  const handleLogin = useCallback(async (token: string): Promise<void> => {
    try {
      if (!token?.trim()) {
        throw new Error('Invalid token provided');
      }

      // Attempt login through auth service
      await authService.current.login(token);
      const authState = authService.current.getAuthState();

      // Update authentication state
      setState({
        ...authState,
        lastActivity: Date.now(),
        sessionExpiry: Date.now() + sessionTimeout
      });

      // Initialize session monitoring
      startSessionMonitoring();
      
      // Set up token refresh cycle
      startTokenRefresh();

    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }, [sessionTimeout]);

  /**
   * Securely handles user logout with complete cleanup
   */
  const handleLogout = useCallback((): void => {
    try {
      // Clear all sensitive data
      authService.current.logout();
      
      // Reset to initial state
      setState(initialAuthState);
      
      // Clear all timers
      stopSessionMonitoring();
      stopTokenRefresh();

    } catch (error) {
      console.error('Logout error:', error);
      // Ensure state is reset even on error
      setState(initialAuthState);
    }
  }, []);

  /**
   * Implements secure token refresh mechanism
   */
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      if (!state.isAuthenticated || !state.token) {
        return;
      }

      const newAuthState = await authService.current.refreshToken();
      
      setState(prev => ({
        ...prev,
        ...newAuthState,
        lastActivity: Date.now(),
        sessionExpiry: Date.now() + sessionTimeout
      }));

    } catch (error) {
      console.error('Token refresh failed:', error);
      handleLogout();
    }
  }, [state.isAuthenticated, state.token, sessionTimeout, handleLogout]);

  /**
   * Validates user permissions based on role
   */
  const checkPermission = useCallback((permission: string): boolean => {
    return authService.current.hasRole(state.role);
  }, [state.role]);

  /**
   * Monitors user session activity
   */
  const startSessionMonitoring = useCallback(() => {
    if (activityTimeout.current) {
      clearTimeout(activityTimeout.current);
    }

    activityTimeout.current = setTimeout(() => {
      if (Date.now() >= state.sessionExpiry) {
        handleLogout();
      }
    }, sessionTimeout);
  }, [sessionTimeout, handleLogout, state.sessionExpiry]);

  /**
   * Manages token refresh cycle
   */
  const startTokenRefresh = useCallback(() => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    refreshInterval.current = setInterval(() => {
      refreshToken();
    }, tokenRefreshInterval);
  }, [refreshToken, tokenRefreshInterval]);

  /**
   * Cleans up session monitoring
   */
  const stopSessionMonitoring = useCallback(() => {
    if (activityTimeout.current) {
      clearTimeout(activityTimeout.current);
      activityTimeout.current = undefined;
    }
  }, []);

  /**
   * Cleans up token refresh cycle
   */
  const stopTokenRefresh = useCallback(() => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = undefined;
    }
  }, []);

  /**
   * Updates session activity timestamp
   */
  const updateActivity = useCallback(() => {
    if (state.isAuthenticated) {
      setState(prev => ({
        ...prev,
        lastActivity: Date.now(),
        sessionExpiry: Date.now() + sessionTimeout
      }));
      startSessionMonitoring();
    }
  }, [state.isAuthenticated, sessionTimeout, startSessionMonitoring]);

  // Effect for session restoration
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const isValid = await authService.current.checkAuth();
        if (isValid) {
          const authState = authService.current.getAuthState();
          setState({
            ...authState,
            lastActivity: Date.now(),
            sessionExpiry: Date.now() + sessionTimeout
          });
          startSessionMonitoring();
          startTokenRefresh();
        }
      } catch (error) {
        console.error('Session restoration failed:', error);
        handleLogout();
      }
    };

    restoreSession();

    return () => {
      stopSessionMonitoring();
      stopTokenRefresh();
    };
  }, [sessionTimeout, startSessionMonitoring, startTokenRefresh, stopSessionMonitoring, stopTokenRefresh, handleLogout]);

  // Effect for activity monitoring
  useEffect(() => {
    const handleActivity = () => {
      updateActivity();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [updateActivity]);

  // Memoized context value
  const contextValue = useMemo(() => ({
    state,
    login: handleLogin,
    logout: handleLogout,
    refreshToken,
    checkPermission
  }), [state, handleLogin, handleLogout, refreshToken, checkPermission]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook for accessing authentication context with built-in error handling
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
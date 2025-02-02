import { jwtDecode } from 'jwt-decode'; // v4.0.0
import { AuthState, UserRole } from '../types/auth.types';
import { StorageService } from './storage';
import { WebSocketService } from './websocket';
import { ERROR_CODES, AUTH_TOKEN_KEY, AUTH_TIMEOUT } from '../config/constants';

// Constants for authentication service
const AUTH_STORAGE_KEY = 'auth_token';
const TOKEN_REFRESH_THRESHOLD = 300000; // 5 minutes before expiry
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_ATTEMPT_TIMEOUT = 300000; // 5 minutes

/**
 * Enhanced authentication service managing secure token-based authentication
 * with automatic refresh, role-based access control, and encrypted storage
 */
export class AuthService {
  private currentState: AuthState;
  private authAttempts: number;
  private lastAttemptTime: number;
  private refreshTimer?: NodeJS.Timeout;

  constructor(
    private readonly storageService: StorageService,
    private readonly webSocketService: WebSocketService
  ) {
    this.currentState = {
      isAuthenticated: false,
      token: null,
      role: UserRole.GUEST,
      tokenExpiry: 0
    };
    this.authAttempts = 0;
    this.lastAttemptTime = 0;

    // Attempt to restore session from encrypted storage
    this.restoreSession();
  }

  /**
   * Authenticate user with enhanced security measures
   * @param token Long-lived access token from Home Assistant
   * @throws Error if authentication fails or rate limit exceeded
   */
  public async login(token: string): Promise<void> {
    try {
      // Check rate limiting
      if (this.isRateLimited()) {
        throw new Error(`Authentication attempts exceeded. Please wait ${AUTH_ATTEMPT_TIMEOUT / 1000} seconds.`);
      }

      this.incrementAuthAttempts();

      // Validate token format and decode
      if (!this.isValidTokenFormat(token)) {
        throw new Error('Invalid token format');
      }

      const decodedToken = this.decodeAndValidateToken(token);
      const role = this.determineUserRole(decodedToken);

      // Store token securely
      await this.storageService.setEncryptedItem(AUTH_STORAGE_KEY, {
        token,
        role,
        expiry: decodedToken.exp * 1000
      });

      // Update authentication state
      this.currentState = {
        isAuthenticated: true,
        token,
        role,
        tokenExpiry: decodedToken.exp * 1000
      };

      // Initialize WebSocket connection
      await this.webSocketService.connect();

      // Setup token refresh
      this.setupTokenRefresh();

      // Reset auth attempts on successful login
      this.resetAuthAttempts();
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Securely clear authentication state and connections
   */
  public logout(): void {
    // Clear secure storage
    this.storageService.removeItem(AUTH_STORAGE_KEY);

    // Reset authentication state
    this.currentState = {
      isAuthenticated: false,
      token: null,
      role: UserRole.GUEST,
      tokenExpiry: 0
    };

    // Clear refresh timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    // Disconnect WebSocket
    this.webSocketService.disconnect();

    // Reset security counters
    this.resetAuthAttempts();
  }

  /**
   * Verify authentication status with enhanced validation
   * @returns Promise resolving to authentication validity
   */
  public async checkAuth(): Promise<boolean> {
    try {
      // Check current auth state
      if (!this.currentState.isAuthenticated || !this.currentState.token) {
        return false;
      }

      // Verify token expiration
      if (Date.now() >= this.currentState.tokenExpiry) {
        this.logout();
        return false;
      }

      // Verify token with Home Assistant
      const isValid = await this.verifyTokenWithHA(this.currentState.token);
      if (!isValid) {
        this.logout();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  /**
   * Get current authentication state
   * @returns Current AuthState
   */
  public getAuthState(): AuthState {
    return { ...this.currentState };
  }

  /**
   * Check if user has required role
   * @param requiredRole Minimum required role level
   * @returns boolean indicating if user has sufficient permissions
   */
  public hasRole(requiredRole: UserRole): boolean {
    const roleHierarchy = {
      [UserRole.ADMIN]: 3,
      [UserRole.USER]: 2,
      [UserRole.GUEST]: 1
    };

    return roleHierarchy[this.currentState.role] >= roleHierarchy[requiredRole];
  }

  private async restoreSession(): Promise<void> {
    try {
      const storedAuth = await this.storageService.getEncryptedItem(AUTH_STORAGE_KEY);
      if (!storedAuth) return;

      const { token, role, expiry } = storedAuth;

      // Verify token is still valid
      if (Date.now() >= expiry) {
        this.storageService.removeItem(AUTH_STORAGE_KEY);
        return;
      }

      // Restore authentication state
      this.currentState = {
        isAuthenticated: true,
        token,
        role,
        tokenExpiry: expiry
      };

      // Reconnect WebSocket
      await this.webSocketService.connect();

      // Setup refresh timer
      this.setupTokenRefresh();
    } catch (error) {
      console.error('Session restoration failed:', error);
      this.logout();
    }
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    if (now - this.lastAttemptTime > AUTH_ATTEMPT_TIMEOUT) {
      this.resetAuthAttempts();
      return false;
    }
    return this.authAttempts >= MAX_AUTH_ATTEMPTS;
  }

  private incrementAuthAttempts(): void {
    this.authAttempts++;
    this.lastAttemptTime = Date.now();
  }

  private resetAuthAttempts(): void {
    this.authAttempts = 0;
    this.lastAttemptTime = 0;
  }

  private isValidTokenFormat(token: string): boolean {
    const tokenRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    return tokenRegex.test(token);
  }

  private decodeAndValidateToken(token: string): any {
    try {
      const decoded = jwtDecode(token);
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token structure');
      }
      return decoded;
    } catch (error) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  private determineUserRole(decodedToken: any): UserRole {
    // Extract role from token claims
    const tokenRole = decodedToken.role?.toLowerCase();
    
    switch (tokenRole) {
      case 'admin':
        return UserRole.ADMIN;
      case 'user':
        return UserRole.USER;
      default:
        return UserRole.GUEST;
    }
  }

  private async verifyTokenWithHA(token: string): Promise<boolean> {
    try {
      const response = await fetch('/auth/token/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  private setupTokenRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    const timeUntilRefresh = this.currentState.tokenExpiry - Date.now() - TOKEN_REFRESH_THRESHOLD;
    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(() => this.refreshToken(), timeUntilRefresh);
    }
  }

  private async refreshToken(): Promise<void> {
    try {
      if (!this.currentState.token) return;

      const response = await fetch('/auth/token/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.currentState.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { token } = await response.json();
      await this.login(token);
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.logout();
    }
  }
}
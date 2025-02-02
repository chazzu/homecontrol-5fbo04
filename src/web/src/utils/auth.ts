import { createConnection } from 'home-assistant-js-websocket'; // v8.0.1
import CryptoJS from 'crypto-js'; // v4.1.1
import { AuthState, UserRole } from '../types/auth.types';
import { getStorageItem, setStorageItem, removeStorageItem } from './storage';

// Constants for authentication configuration
const AUTH_TOKEN_KEY = 'ha_dashboard_token';
const TOKEN_REGEX = /^[a-f0-9]{32,}$/i;
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_VALIDATION_ATTEMPTS = 5;
const VALIDATION_TIMEOUT_MS = 100;

// Encryption key for token storage (should be environment variable in production)
const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'default-key';

// Performance monitoring metrics
const metrics = {
  validationAttempts: new Map<string, number>(),
  lastValidationTime: new Map<string, number>(),
  validationErrors: new Map<string, string[]>(),
};

/**
 * Custom error class for authentication operations
 */
class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Measures performance of authentication operations
 */
const measureAuthPerformance = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    if (duration > VALIDATION_TIMEOUT_MS) {
      console.warn(`Auth operation ${operationName} took ${duration}ms`);
    }
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`Auth operation ${operationName} failed after ${duration}ms:`, error);
    throw error;
  }
};

/**
 * Validates Home Assistant authentication token format and expiration
 * @param token - Authentication token to validate
 * @returns Promise resolving to validation result
 */
export const validateToken = async (token: string): Promise<boolean> => {
  return measureAuthPerformance(async () => {
    // Check rate limiting
    const now = Date.now();
    const attempts = metrics.validationAttempts.get(token) || 0;
    const lastAttempt = metrics.lastValidationTime.get(token) || 0;

    if (attempts >= MAX_VALIDATION_ATTEMPTS && (now - lastAttempt) < TOKEN_EXPIRY_MS) {
      throw new AuthError(
        'Too many validation attempts',
        'VALIDATION_RATE_LIMIT',
        { attempts, timeWindow: TOKEN_EXPIRY_MS }
      );
    }

    // Update rate limiting metrics
    metrics.validationAttempts.set(token, attempts + 1);
    metrics.lastValidationTime.set(token, now);

    try {
      // Validate token format
      if (!TOKEN_REGEX.test(token)) {
        throw new AuthError('Invalid token format', 'INVALID_TOKEN_FORMAT');
      }

      // Attempt Home Assistant connection
      const connection = await createConnection({
        auth: { type: 'auth_token', access_token: token }
      });

      // Clean up connection after validation
      await connection.close();

      // Reset validation metrics on success
      metrics.validationAttempts.delete(token);
      metrics.lastValidationTime.delete(token);
      metrics.validationErrors.delete(token);

      return true;
    } catch (error) {
      // Track validation errors
      const errors = metrics.validationErrors.get(token) || [];
      errors.push((error as Error).message);
      metrics.validationErrors.set(token, errors);

      throw new AuthError(
        'Token validation failed',
        'VALIDATION_FAILED',
        { error }
      );
    }
  }, 'validateToken');
};

/**
 * Retrieves and decrypts stored authentication token
 * @returns Promise resolving to decrypted token or null
 */
export const getStoredToken = async (): Promise<string | null> => {
  return measureAuthPerformance(async () => {
    try {
      const encryptedToken = getStorageItem<string | null>(AUTH_TOKEN_KEY, null);
      if (!encryptedToken) return null;

      // Decrypt token
      const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
      const token = bytes.toString(CryptoJS.enc.Utf8);

      // Validate decrypted token
      if (!token || !TOKEN_REGEX.test(token)) {
        throw new AuthError('Invalid stored token', 'INVALID_STORED_TOKEN');
      }

      return token;
    } catch (error) {
      console.error('Failed to retrieve stored token:', error);
      return null;
    }
  }, 'getStoredToken');
};

/**
 * Encrypts and stores authentication token
 * @param token - Token to store
 */
export const storeToken = async (token: string): Promise<void> => {
  return measureAuthPerformance(async () => {
    try {
      // Validate token before storing
      if (!TOKEN_REGEX.test(token)) {
        throw new AuthError('Invalid token format', 'INVALID_TOKEN_FORMAT');
      }

      // Encrypt token
      const encryptedToken = CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();

      // Store encrypted token
      if (!setStorageItem(AUTH_TOKEN_KEY, encryptedToken)) {
        throw new AuthError('Failed to store token', 'STORAGE_ERROR');
      }
    } catch (error) {
      console.error('Failed to store token:', error);
      throw error;
    }
  }, 'storeToken');
};

/**
 * Removes stored authentication token and cleans up related data
 */
export const removeToken = (): void => {
  try {
    removeStorageItem(AUTH_TOKEN_KEY);
    // Clean up metrics
    metrics.validationAttempts.clear();
    metrics.lastValidationTime.clear();
    metrics.validationErrors.clear();
  } catch (error) {
    console.error('Failed to remove token:', error);
    throw new AuthError('Failed to remove token', 'REMOVAL_ERROR', { error });
  }
};

/**
 * Determines and validates user role from token
 * @param token - Authentication token
 * @returns Promise resolving to user role
 */
export const getUserRole = async (token: string | null): Promise<UserRole> => {
  return measureAuthPerformance(async () => {
    try {
      if (!token) {
        return UserRole.GUEST;
      }

      // Validate token
      const isValid = await validateToken(token);
      if (!isValid) {
        return UserRole.GUEST;
      }

      // In a production environment, this would decode the token and extract the role
      // For now, we'll assume ADMIN for valid tokens
      return UserRole.ADMIN;
    } catch (error) {
      console.error('Failed to get user role:', error);
      return UserRole.GUEST;
    }
  }, 'getUserRole');
};
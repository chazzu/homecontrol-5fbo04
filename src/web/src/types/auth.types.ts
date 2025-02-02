// @ts-check
import { ReactNode } from 'react'; // v18.0.0

/**
 * Enumeration of available user roles with corresponding access levels.
 * Used for role-based access control throughout the application.
 */
export enum UserRole {
    ADMIN = 'ADMIN',   // Full system access
    USER = 'USER',     // Basic control access
    GUEST = 'GUEST'    // View-only access
}

/**
 * Interface defining the authentication state structure.
 * Maintains core authentication information including token and role.
 */
export interface AuthState {
    /** Indicates if the user is currently authenticated */
    isAuthenticated: boolean;
    
    /** Authentication token for Home Assistant API communication */
    token: string | null;
    
    /** Current user's role determining access levels */
    role: UserRole;
}

/**
 * Interface defining the authentication context structure.
 * Provides authentication state and methods for auth management.
 */
export interface AuthContextType {
    /** Current authentication state */
    state: AuthState;
    
    /**
     * Authenticates user with Home Assistant token
     * @param token - Long-lived access token from Home Assistant
     * @returns Promise resolving when authentication is complete
     */
    login: (token: string) => Promise<void>;
    
    /**
     * Logs out current user and clears authentication state
     */
    logout: () => void;
    
    /**
     * Validates current authentication status
     * @returns Promise resolving to authentication validity
     */
    checkAuth: () => Promise<boolean>;
}

/**
 * Interface defining the authentication provider component props.
 * Used for the AuthProvider component that wraps the application.
 */
export interface AuthProviderProps {
    /** Child components to be wrapped by the AuthProvider */
    children: ReactNode;
}
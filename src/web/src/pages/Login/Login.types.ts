import { ReactElement } from 'react'; // v18.0.0
import { AuthState } from '../../types/auth.types';

/**
 * Props interface for the Login component.
 * Defines callback handlers for successful and failed authentication attempts.
 */
export interface LoginProps {
    /** Callback function triggered on successful authentication */
    onSuccess: () => void;
    
    /** Callback function triggered on authentication error with error message */
    onError: (error: string) => void;
}

/**
 * Interface defining the structure of login form data.
 * Contains the long-lived access token for Home Assistant authentication.
 */
export interface LoginFormData {
    /** Long-lived access token from Home Assistant */
    token: string;
}

/**
 * Interface defining the state of the login form.
 * Tracks loading state during authentication and potential error messages.
 */
export interface LoginFormState {
    /** Indicates if authentication request is in progress */
    loading: boolean;
    
    /** Error message if authentication fails, null if no error */
    error: string | null;
}

/**
 * Type definition for the login form validation result.
 * Used for token format and length validation.
 */
export type LoginValidationResult = {
    /** Indicates if the token is valid */
    isValid: boolean;
    
    /** Validation error message if token is invalid */
    error?: string;
};

/**
 * Interface defining the login form submission handler.
 * Used for processing form submission with token validation.
 */
export interface LoginSubmitHandler {
    /** Form submission handler with token validation and error handling */
    (data: LoginFormData): Promise<void>;
}

/**
 * Type definition for the login component return value.
 * Ensures proper typing for the React component.
 */
export type LoginComponent = (props: LoginProps) => ReactElement;
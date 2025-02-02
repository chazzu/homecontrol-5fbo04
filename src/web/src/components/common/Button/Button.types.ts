/**
 * Type definitions for the reusable Button component
 * Implements WCAG 2.1 Level AA compliance with comprehensive theme support
 * @version 1.0.0
 */

import { ReactNode } from 'react'; // v18.0.0
import { Theme } from '../../types/theme.types';

/**
 * Enumeration of available button variants
 * Maps directly to theme color scheme for consistent styling
 */
export enum ButtonVariant {
    PRIMARY = 'primary',
    SECONDARY = 'secondary',
    SUCCESS = 'success',
    WARNING = 'warning',
    ERROR = 'error'
}

/**
 * Enumeration of available button sizes
 * Provides consistent component scaling across the application
 */
export enum ButtonSize {
    SMALL = 'small',
    MEDIUM = 'medium',
    LARGE = 'large'
}

/**
 * Button component props interface with WCAG 2.1 Level AA compliance
 * Includes comprehensive accessibility attributes and event handlers
 */
export interface ButtonProps {
    /** Content to be rendered within the button */
    children: ReactNode;

    /** Visual variant of the button, mapped to theme colors */
    variant: ButtonVariant;

    /** Size variant affecting button dimensions */
    size: ButtonSize;

    /** Disabled state of the button */
    disabled?: boolean;

    /** Whether the button should take full width of its container */
    fullWidth?: boolean;

    /** Click event handler for the button */
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

    /** HTML button type attribute */
    type?: 'button' | 'submit' | 'reset';

    /** Accessible label for screen readers (WCAG 2.1) */
    ariaLabel?: string;

    /** Indicates if the button controls an expanded element (WCAG 2.1) */
    ariaExpanded?: boolean;

    /** ID of the element controlled by the button (WCAG 2.1) */
    ariaControls?: string;

    /** ARIA role override for specialized button behaviors */
    role?: string;
}
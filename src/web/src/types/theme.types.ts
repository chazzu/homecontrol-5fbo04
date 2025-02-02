/**
 * Theme system type definitions for Smart Home Dashboard
 * Defines types for theme modes, color schemes, and theme configuration
 * @version 1.0.0
 */

/**
 * Available theme modes for the application
 * Supports light and dark themes as specified in technical requirements
 */
export enum ThemeMode {
    LIGHT = 'light',
    DARK = 'dark'
}

/**
 * Color scheme interface defining the structure of theme colors
 * Implements both light and dark theme color requirements from technical specification
 */
export interface ColorScheme {
    /** Main background color */
    background: string;
    
    /** Primary text color */
    text: string;
    
    /** Primary accent color for interactive elements */
    primary: string;
    
    /** Secondary accent color for supplementary elements */
    secondary: string;
    
    /** Border color for separators and containers */
    border: string;
    
    /** Success state color for positive feedback */
    success: string;
    
    /** Warning state color for cautionary feedback */
    warning: string;
    
    /** Error state color for negative feedback */
    error: string;
}

/**
 * Complete theme configuration interface
 * Combines theme mode selection with corresponding color scheme
 */
export interface Theme {
    /** Active theme mode (light/dark) */
    mode: ThemeMode;
    
    /** Color scheme configuration for the active theme */
    colors: ColorScheme;
}
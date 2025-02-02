/**
 * Theme utility functions for Smart Home Dashboard
 * Manages theme application, storage, and transitions with error handling
 * @version 1.0.0
 */

import { ThemeMode, Theme, ColorScheme } from '../types/theme.types';
import { THEME_STORAGE_KEY, getTheme } from '../config/theme';

/**
 * CSS variable names for theme colors
 * Maps color scheme properties to CSS custom properties
 */
const CSS_VARS = {
    background: '--color-background',
    text: '--color-text',
    primary: '--color-primary',
    secondary: '--color-secondary',
    border: '--color-border',
    success: '--color-success',
    warning: '--color-warning',
    error: '--color-error'
} as const;

/**
 * Calculates color contrast ratio for accessibility validation
 * @param color1 - First color in hex format
 * @param color2 - Second color in hex format
 * @returns Contrast ratio between the colors
 */
const getContrastRatio = (color1: string, color2: string): number => {
    const getLuminance = (hex: string): number => {
        const rgb = parseInt(hex.slice(1), 16);
        const r = ((rgb >> 16) & 0xff) / 255;
        const g = ((rgb >> 8) & 0xff) / 255;
        const b = (rgb & 0xff) / 255;
        const [lr, lg, lb] = [r, g, b].map(c => 
            c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        );
        return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };

    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return Number(ratio.toFixed(2));
};

/**
 * Applies theme colors to CSS variables with error handling and performance optimization
 * @param theme - Theme configuration to apply
 * @throws Error if theme application fails
 */
export const applyTheme = (theme: Theme): void => {
    try {
        // Validate theme object
        if (!theme?.colors || !theme?.mode) {
            throw new Error('Invalid theme configuration');
        }

        // Get document root element
        const root = document.documentElement;
        if (!root) {
            throw new Error('Document root element not found');
        }

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Set transition duration based on motion preference
        root.style.setProperty(
            '--theme-transition-duration',
            prefersReducedMotion ? '0s' : '0.3s'
        );

        // Use requestAnimationFrame for smooth transitions
        requestAnimationFrame(() => {
            // Apply color variables
            Object.entries(theme.colors).forEach(([key, value]) => {
                const cssVar = CSS_VARS[key as keyof ColorScheme];
                if (cssVar) {
                    root.style.setProperty(cssVar, value);
                }
            });

            // Set theme mode attribute
            root.setAttribute('data-theme', theme.mode);

            // Validate contrast ratios for accessibility
            const { background, text, primary } = theme.colors;
            const textContrast = getContrastRatio(background, text);
            const primaryContrast = getContrastRatio(background, primary);

            if (textContrast < 4.5 || primaryContrast < 3) {
                console.warn('Theme colors may not meet WCAG contrast requirements', {
                    textContrast,
                    primaryContrast
                });
            }
        });

        // Log successful theme application
        console.debug('Theme applied successfully:', theme.mode);
    } catch (error) {
        console.error('Failed to apply theme:', error);
        throw error;
    }
};

/**
 * Retrieves stored theme mode with validation and fallback
 * @returns Stored theme mode or undefined if not set/invalid
 */
export const getStoredTheme = (): ThemeMode | undefined => {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored) return undefined;

        // Validate stored value
        const mode = stored as ThemeMode;
        if (!Object.values(ThemeMode).includes(mode)) {
            console.warn('Invalid stored theme mode:', stored);
            return undefined;
        }

        return mode;
    } catch (error) {
        console.error('Failed to retrieve stored theme:', error);
        return undefined;
    }
};

/**
 * Stores theme mode with error handling and quota management
 * @param mode - Theme mode to store
 * @throws Error if storage fails
 */
export const setStoredTheme = (mode: ThemeMode): void => {
    try {
        // Validate mode before storage
        if (!Object.values(ThemeMode).includes(mode)) {
            throw new Error('Invalid theme mode');
        }

        // Attempt storage with quota check
        try {
            localStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch (storageError) {
            // Handle quota exceeded error
            if (storageError instanceof Error && storageError.name === 'QuotaExceededError') {
                localStorage.clear(); // Clear storage as recovery action
                localStorage.setItem(THEME_STORAGE_KEY, mode); // Retry storage
            } else {
                throw storageError;
            }
        }

        // Verify storage success
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored !== mode) {
            throw new Error('Theme storage verification failed');
        }

        console.debug('Theme preference stored:', mode);
    } catch (error) {
        console.error('Failed to store theme preference:', error);
        throw error;
    }
};

/**
 * Toggles between light and dark themes with smooth transition
 * @param currentMode - Current theme mode
 * @returns New theme mode after toggle
 * @throws Error if theme toggle fails
 */
export const toggleTheme = (currentMode: ThemeMode): ThemeMode => {
    try {
        // Validate current mode
        if (!Object.values(ThemeMode).includes(currentMode)) {
            throw new Error('Invalid current theme mode');
        }

        // Determine new mode
        const newMode = currentMode === ThemeMode.LIGHT ? ThemeMode.DARK : ThemeMode.LIGHT;
        
        // Get and validate new theme configuration
        const newTheme = getTheme(newMode);
        if (!newTheme) {
            throw new Error('Failed to get new theme configuration');
        }

        // Apply new theme with transition
        applyTheme(newTheme);
        
        // Persist theme preference
        setStoredTheme(newMode);

        console.debug('Theme toggled:', newMode);
        return newMode;
    } catch (error) {
        console.error('Failed to toggle theme:', error);
        throw error;
    }
};
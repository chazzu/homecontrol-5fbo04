/**
 * Core theme configuration for Smart Home Dashboard
 * Manages theme settings, default theme, and theme utilities
 * Implements light/dark mode support with CSS variables system
 * @version 1.0.0
 */

import { ThemeMode, Theme } from '../types/theme.types';
import lightTheme from '../assets/styles/themes/light';
import darkTheme from '../assets/styles/themes/dark';

/**
 * LocalStorage key for persisting user theme preference
 * Used to maintain theme selection across sessions
 */
export const THEME_STORAGE_KEY = 'theme_mode';

/**
 * Default theme configuration used at application startup
 * Uses light theme as the default experience
 */
export const DEFAULT_THEME: Theme = lightTheme;

/**
 * Returns the validated theme configuration based on the specified theme mode
 * Includes fallback handling and runtime validation
 * 
 * @param mode - The desired theme mode (light/dark)
 * @returns Validated theme configuration object
 * @throws Error if theme validation fails
 */
export const getTheme = (mode: ThemeMode): Theme => {
    // Validate input theme mode
    if (!Object.values(ThemeMode).includes(mode)) {
        console.warn(`Invalid theme mode: ${mode}, falling back to default theme`);
        return DEFAULT_THEME;
    }

    // Select theme based on mode
    const selectedTheme = mode === ThemeMode.LIGHT ? lightTheme : darkTheme;

    // Validate theme structure
    if (!selectedTheme || !selectedTheme.colors) {
        console.error('Invalid theme configuration detected');
        return DEFAULT_THEME;
    }

    // Validate color values
    const { colors } = selectedTheme;
    const isValidHexColor = (color: string): boolean => 
        /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);

    // Ensure all colors are valid hex values
    const colorKeys = Object.keys(colors) as Array<keyof typeof colors>;
    const invalidColors = colorKeys.filter(key => !isValidHexColor(colors[key]));

    if (invalidColors.length > 0) {
        console.error('Invalid color values detected:', invalidColors);
        return DEFAULT_THEME;
    }

    // Return validated theme
    return selectedTheme;
};
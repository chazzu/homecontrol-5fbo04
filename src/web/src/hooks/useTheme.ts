/**
 * Custom React hook for theme management in Smart Home Dashboard
 * Provides theme switching, persistence, system theme detection, and CSS variable application
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react'; // v18.0.0
import { Theme, ThemeMode } from '../types/theme.types';
import lightTheme from '../assets/styles/themes/light';
import darkTheme from '../assets/styles/themes/dark';

// Storage key for theme persistence
const THEME_STORAGE_KEY = 'smart-home-dashboard-theme';

/**
 * Custom hook for comprehensive theme management
 * @returns Object containing current theme and theme management functions
 */
export const useTheme = () => {
    // Initialize theme state with stored preference or system preference
    const [theme, setThemeState] = useState<Theme>(() => {
        // Check for stored theme preference
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme) {
            return JSON.parse(storedTheme);
        }

        // Fall back to system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return darkTheme;
        }
        return lightTheme;
    });

    /**
     * Applies theme CSS variables to document root
     * Uses requestAnimationFrame for performance optimization
     */
    const applyTheme = useCallback((newTheme: Theme) => {
        requestAnimationFrame(() => {
            const root = document.documentElement;
            
            // Apply color scheme variables
            Object.entries(newTheme.colors).forEach(([key, value]) => {
                root.style.setProperty(`--color-${key}`, value);
            });

            // Set theme mode attribute for potential CSS selectors
            root.setAttribute('data-theme', newTheme.mode);
        });
    }, []);

    /**
     * Theme setter with persistence
     */
    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
    }, []);

    /**
     * Theme toggle function
     */
    const toggleTheme = useCallback(() => {
        setThemeState(currentTheme => 
            currentTheme.mode === ThemeMode.LIGHT ? darkTheme : lightTheme
        );
    }, []);

    // Effect: Handle system theme preference changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleChange = (e: MediaQueryListEvent) => {
            if (!localStorage.getItem(THEME_STORAGE_KEY)) {
                setThemeState(e.matches ? darkTheme : lightTheme);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Effect: Apply theme changes
    useEffect(() => {
        applyTheme(theme);
    }, [theme, applyTheme]);

    // Effect: Persist theme changes
    useEffect(() => {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    }, [theme]);

    // Effect: Announce theme changes for accessibility
    useEffect(() => {
        const message = `Theme changed to ${theme.mode} mode`;
        if ('speechSynthesis' in window) {
            const announcement = new SpeechSynthesisUtterance(message);
            announcement.volume = 0.3;
            window.speechSynthesis.speak(announcement);
        }
    }, [theme.mode]);

    return {
        theme,
        setTheme,
        toggleTheme
    };
};
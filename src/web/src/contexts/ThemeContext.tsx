/**
 * Theme Context Provider for Smart Home Dashboard
 * Implements application-wide theme state management with light/dark mode support
 * @version 1.0.0
 */

import { createContext, useContext, ReactNode } from 'react'; // v18.0.0
import { Theme, ThemeMode } from '../types/theme.types';
import { useTheme } from '../hooks/useTheme';

/**
 * Interface defining the shape of theme context
 * Provides type safety for theme state and management functions
 */
interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

/**
 * Initial context value with type-safe null implementations
 * Prevents undefined context access before provider initialization
 */
const initialThemeContext: ThemeContextType = {
    theme: null as unknown as Theme,
    setTheme: () => null,
    toggleTheme: () => null,
};

/**
 * Theme context for application-wide theme state management
 * Provides access to theme state and control functions
 */
export const ThemeContext = createContext<ThemeContextType>(initialThemeContext);

/**
 * Props interface for ThemeProvider component
 */
interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * Theme Provider component that wraps the application
 * Provides theme context and handles theme state management
 */
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
    // Initialize theme state and management functions using custom hook
    const { theme, setTheme, toggleTheme } = useTheme();

    // Memoized context value to prevent unnecessary re-renders
    const contextValue: ThemeContextType = {
        theme,
        setTheme,
        toggleTheme,
    };

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

/**
 * Custom hook for accessing theme context with error handling
 * Provides type-safe access to theme state and management functions
 * @throws {Error} When used outside of ThemeProvider
 */
export const useThemeContext = (): ThemeContextType => {
    const context = useContext(ThemeContext);

    if (context === initialThemeContext) {
        throw new Error(
            'useThemeContext must be used within a ThemeProvider. ' +
            'Please wrap your component tree with ThemeProvider.'
        );
    }

    return context;
};
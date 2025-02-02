/**
 * Light theme configuration for Smart Home Dashboard
 * Implements the light mode color scheme as specified in technical requirements
 * @version 1.0.0
 */

import { ThemeMode, Theme, ColorScheme } from '../../types/theme.types';

/**
 * Light theme configuration implementing the Theme interface
 * Color values are based on the technical specification section 6.5.1
 */
const lightTheme: Theme = {
    // Set theme mode to light as per ThemeMode enum
    mode: ThemeMode.LIGHT,
    
    // Color scheme configuration following ColorScheme interface
    colors: {
        // Main background color - pure white for maximum contrast
        background: '#FFFFFF',
        
        // Primary text color - pure black for optimal readability
        text: '#000000',
        
        // Primary accent color - iOS-style blue for interactive elements
        primary: '#007AFF',
        
        // Secondary accent color - purple for supplementary elements
        secondary: '#5856D6',
        
        // Border color - light gray for subtle separation
        border: '#C7C7CC',
        
        // Success state color - green for positive feedback
        success: '#34C759',
        
        // Warning state color - orange for cautionary feedback
        warning: '#FF9500',
        
        // Error state color - red for negative feedback
        error: '#FF3B30'
    }
};

export default lightTheme;
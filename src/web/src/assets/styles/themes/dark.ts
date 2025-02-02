/**
 * Dark theme configuration for Smart Home Dashboard
 * Implements dark mode color scheme as specified in technical requirements
 * @version 1.0.0
 */

import { ThemeMode, Theme, ColorScheme } from '../../../types/theme.types';

/**
 * Dark theme configuration implementing the Theme interface
 * Colors are based on the technical specification section 6.5.2
 */
const darkTheme: Theme = {
    // Set theme mode to dark as per ThemeMode enum
    mode: ThemeMode.DARK,
    
    // Color scheme configuration following technical specifications
    colors: {
        // Main background color - Pure black for OLED optimization
        background: '#000000',
        
        // Primary text color - Pure white for maximum contrast
        text: '#FFFFFF',
        
        // Primary accent color - iOS-style blue for interactive elements
        primary: '#0A84FF',
        
        // Secondary accent color - Muted purple for supplementary elements
        secondary: '#5E5CE6',
        
        // Border color - Dark gray for subtle separation
        border: '#38383A',
        
        // Success state color - Green for positive feedback
        success: '#30D158',
        
        // Warning state color - Orange for cautionary feedback
        warning: '#FF9F0A',
        
        // Error state color - Red for negative feedback
        error: '#FF453A'
    }
};

// Export the dark theme configuration for application-wide use
export default darkTheme;
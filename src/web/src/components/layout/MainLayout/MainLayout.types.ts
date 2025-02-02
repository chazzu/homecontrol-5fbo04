/**
 * Type definitions for the MainLayout component
 * Provides the root layout structure and theme context for the Smart Home Dashboard
 * @version 1.0.0
 */

import { ReactNode } from 'react'; // ^18.0.0
import { Theme } from '../../types/theme.types';

/**
 * Props interface for the MainLayout component
 * Defines the required properties for rendering the main application layout
 * 
 * @property {ReactNode} children - Child components to be rendered within the layout
 * @property {Theme} theme - Theme configuration for styling the layout and its children
 */
export interface MainLayoutProps {
    /** Child components to be rendered within the layout structure */
    children: ReactNode;

    /** Theme configuration containing mode and color scheme */
    theme: Theme;
}
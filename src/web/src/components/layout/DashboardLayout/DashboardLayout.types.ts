/**
 * Type definitions for the DashboardLayout component
 * Defines interfaces and types for layout structure, props, responsive behavior, and theme integration
 * @version 1.0.0
 */

import { ReactNode } from 'react';
import { Theme } from '../../../types/theme.types';

/**
 * Enumeration of responsive breakpoints for the dashboard layout
 * Based on technical specifications section 6.4
 */
export enum DashboardBreakpoints {
    MOBILE = '< 768px',
    TABLET = '768px - 1024px',
    DESKTOP = '> 1024px'
}

/**
 * Interface defining props for the DashboardLayout component
 * Implements core layout requirements with theme support
 */
export interface DashboardLayoutProps {
    /** Child components to be rendered within the layout */
    children: ReactNode;
    
    /** Optional CSS class name for custom styling */
    className?: string;
    
    /** Theme configuration for styling support */
    theme: Theme;
}

/**
 * Interface defining the layout state for responsive and visibility controls
 * Supports layout management based on technical specifications
 */
export interface DashboardLayoutState {
    /** Controls sidebar visibility in responsive layouts */
    isSidebarOpen: boolean;
    
    /** Current active breakpoint for responsive behavior */
    currentBreakpoint: DashboardBreakpoints;
    
    /** Controls header visibility for different view modes */
    isHeaderVisible: boolean;
}

/**
 * Interface defining the structure of layout sections
 * Maps to the layout structure defined in technical specifications
 */
export interface DashboardLayoutSections {
    /** Header section configuration */
    header: {
        height: string;
        isFixed: boolean;
    };
    
    /** Sidebar section configuration */
    sidebar: {
        width: string;
        isCollapsible: boolean;
        minWidth: string;
    };
    
    /** Main content section configuration */
    content: {
        padding: string;
        minHeight: string;
    };
}

/**
 * Type definition for layout transition configurations
 * Supports smooth layout transitions during responsive changes
 */
export type DashboardTransitionConfig = {
    /** Duration of layout transitions in milliseconds */
    duration: number;
    
    /** Timing function for layout transitions */
    easing: string;
    
    /** Properties to be animated during transitions */
    properties: string[];
};

/**
 * Interface for layout event handlers
 * Defines callback types for layout-related events
 */
export interface DashboardLayoutHandlers {
    /** Callback for sidebar toggle events */
    onSidebarToggle?: () => void;
    
    /** Callback for breakpoint change events */
    onBreakpointChange?: (breakpoint: DashboardBreakpoints) => void;
    
    /** Callback for layout initialization */
    onLayoutInit?: () => void;
}
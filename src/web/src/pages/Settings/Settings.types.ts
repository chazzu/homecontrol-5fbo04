/**
 * Type definitions for the Settings page component
 * Defines interfaces and types for user preferences, theme configuration, and plugin management
 * @version 1.0.0
 */

import { Theme } from '../types/theme.types';
import { PluginConfig } from '../types/plugin.types';

/**
 * Enumeration of available settings tabs
 * Provides type-safe identifiers for navigation between settings sections
 */
export enum SettingsTabId {
    /** Theme and visual customization settings */
    APPEARANCE = 'appearance',
    
    /** Plugin management and configuration */
    PLUGINS = 'plugins',
    
    /** Advanced system settings */
    ADVANCED = 'advanced'
}

/**
 * Props interface for the Settings component
 * Defines required properties for component instantiation
 */
export interface SettingsProps {
    /** Currently active settings tab */
    activeTab: SettingsTabId;
    
    /** Callback function for tab change events */
    onTabChange: (tab: SettingsTabId) => void;
}

/**
 * Interface defining the complete application settings structure
 * Combines theme, plugin, and system configuration options
 */
export interface AppSettings {
    /** Theme configuration including mode and color scheme */
    theme: Theme;
    
    /** Plugin configurations mapped by plugin ID */
    plugins: Record<string, PluginConfig>;
    
    /** Whether to automatically reconnect on connection loss */
    autoReconnect: boolean;
    
    /** Interval in milliseconds between reconnection attempts */
    reconnectInterval: number;
}

/**
 * Interface for appearance settings form data
 */
export interface AppearanceFormData {
    /** Selected theme mode */
    themeMode: Theme['mode'];
    
    /** Custom color overrides */
    customColors?: Partial<Theme['colors']>;
}

/**
 * Interface for plugin settings form data
 */
export interface PluginFormData {
    /** Plugin enabled state */
    enabled: boolean;
    
    /** Plugin-specific configuration */
    settings: Record<string, unknown>;
}

/**
 * Interface for advanced settings form data
 */
export interface AdvancedFormData {
    /** Auto-reconnect configuration */
    autoReconnect: boolean;
    
    /** Reconnection interval in milliseconds */
    reconnectInterval: number;
    
    /** Debug mode flag */
    debugMode?: boolean;
}

/**
 * Type for settings validation errors
 */
export type SettingsValidationError = {
    /** Field that failed validation */
    field: string;
    
    /** Error message */
    message: string;
    
    /** Error code for programmatic handling */
    code: string;
};

/**
 * Type for settings update events
 */
export type SettingsUpdateEvent = {
    /** Section of settings being updated */
    section: SettingsTabId;
    
    /** Updated settings data */
    data: Partial<AppSettings>;
    
    /** Timestamp of update */
    timestamp: number;
};
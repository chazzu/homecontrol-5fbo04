import { Router } from 'express'; // v4.18.0

/**
 * Represents the possible states of a plugin during its lifecycle
 */
export enum PluginState {
    /** Plugin is installed but not running */
    INACTIVE = "inactive",
    /** Plugin is installed and running */
    ACTIVE = "active",
    /** Plugin encountered an error during operation */
    ERROR = "error",
    /** Plugin is in initialization phase */
    INITIALIZING = "initializing",
    /** Plugin is performing cleanup operations */
    CLEANUP = "cleanup"
}

/**
 * Core interface that all plugins must implement for integration with the Smart Home Dashboard.
 * Defines the contract for plugin lifecycle management, configuration, and integration.
 */
export interface IPlugin {
    /** Unique identifier for the plugin */
    id: string;

    /** Display name of the plugin */
    name: string;

    /** Semantic version of the plugin */
    version: string;

    /** Current state of the plugin */
    state: PluginState;

    /** Brief description of plugin functionality */
    description: string;

    /** Plugin author information */
    author: string;

    /** Plugin configuration object */
    config: Record<string, any>;

    /**
     * Asynchronously initializes the plugin
     * @throws {PluginInitializationError} If initialization fails
     */
    initialize(): Promise<void>;

    /**
     * Asynchronously cleans up plugin resources before unloading
     * @throws {PluginCleanupError} If cleanup fails
     */
    cleanup(): Promise<void>;

    /**
     * Returns Express router for plugin-specific routes
     * @returns {Router} Express router instance for plugin routes
     */
    getRouter?(): Router;

    /**
     * Handler for plugin state changes
     * @param newState - The new state the plugin is transitioning to
     */
    onStateChange?(newState: PluginState): Promise<void>;
}
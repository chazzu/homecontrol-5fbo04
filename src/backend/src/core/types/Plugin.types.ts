import { Router } from 'express'; // ^4.18.0

/**
 * Represents the possible states of a plugin in the system.
 * Used for lifecycle management and state transition validation.
 */
export enum PluginState {
  /** Plugin is installed but not running, ready for initialization */
  INACTIVE = 'inactive',
  /** Plugin is installed, initialized, and running normally */
  ACTIVE = 'active',
  /** Plugin encountered an error during operation, requires intervention */
  ERROR = 'error',
  /** Plugin is in initialization phase, loading resources */
  INITIALIZING = 'initializing',
  /** Plugin is performing cleanup operations before unload */
  CLEANUP = 'cleanup'
}

/**
 * Type definition for flexible plugin configuration storage.
 * Supports runtime type checking and validation of configuration values.
 */
export type PluginConfig = Record<string, any>;

/**
 * Comprehensive metadata interface for plugin identification and management.
 * Includes validation requirements for each field.
 */
export interface PluginMetadata {
  /** Unique identifier for the plugin following UUID v4 format */
  id: string;
  
  /** Display name of the plugin, must be URL-safe */
  name: string;
  
  /** Semantic version of the plugin following SemVer format */
  version: string;
  
  /** Plugin author information with optional email */
  author: string;
  
  /** Brief description of plugin functionality */
  description: string;
  
  /** Plugin dependencies with version requirements */
  dependencies: Record<string, string>;
  
  /** Required system permissions for plugin operation */
  permissions: string[];
}

/**
 * Interface defining lifecycle hooks for plugin management.
 * Includes comprehensive error handling and state management.
 */
export interface PluginLifecycleHooks {
  /**
   * Called when plugin is being initialized.
   * Includes timeout and retry logic for robust initialization.
   * @throws {Error} If initialization fails or times out
   */
  onInitialize: () => Promise<void>;

  /**
   * Called when plugin is being unloaded.
   * Ensures proper resource cleanup and state management.
   * @throws {Error} If cleanup operations fail
   */
  onCleanup: () => Promise<void>;

  /**
   * Called when plugin state changes.
   * Includes state transition validation and error handling.
   * @param newState - The new state being transitioned to
   * @param oldState - The previous state being transitioned from
   * @throws {Error} If state transition is invalid
   */
  onStateChange: (newState: PluginState, oldState: PluginState) => Promise<void>;

  /**
   * Called when plugin encounters an error.
   * Includes error categorization and recovery attempts.
   * @param error - The error that occurred during plugin operation
   * @throws {Error} If error handling fails
   */
  onError: (error: Error) => Promise<void>;
}

/**
 * Type definition for plugin routing capabilities.
 * Includes Express router integration with security middleware support.
 */
export type PluginRouter = Router | undefined;

/**
 * Comprehensive plugin interface combining all required components.
 * Provides complete type safety for plugin implementation.
 */
export interface Plugin {
  /** Plugin metadata for identification and management */
  metadata: PluginMetadata;
  
  /** Current state of the plugin */
  state: PluginState;
  
  /** Plugin configuration */
  config: PluginConfig;
  
  /** Lifecycle hooks for plugin management */
  lifecycle: PluginLifecycleHooks;
  
  /** Optional router for plugin-specific endpoints */
  router?: PluginRouter;
}

/**
 * Type guard to validate plugin metadata structure.
 * @param metadata - Object to validate as plugin metadata
 */
export function isPluginMetadata(metadata: any): metadata is PluginMetadata {
  return (
    typeof metadata === 'object' &&
    typeof metadata.id === 'string' &&
    typeof metadata.name === 'string' &&
    typeof metadata.version === 'string' &&
    typeof metadata.author === 'string' &&
    typeof metadata.description === 'string' &&
    typeof metadata.dependencies === 'object' &&
    Array.isArray(metadata.permissions)
  );
}

/**
 * Type guard to validate complete plugin structure.
 * @param plugin - Object to validate as plugin
 */
export function isPlugin(plugin: any): plugin is Plugin {
  return (
    typeof plugin === 'object' &&
    isPluginMetadata(plugin.metadata) &&
    Object.values(PluginState).includes(plugin.state) &&
    typeof plugin.config === 'object' &&
    typeof plugin.lifecycle === 'object' &&
    typeof plugin.lifecycle.onInitialize === 'function' &&
    typeof plugin.lifecycle.onCleanup === 'function' &&
    typeof plugin.lifecycle.onStateChange === 'function' &&
    typeof plugin.lifecycle.onError === 'function' &&
    (plugin.router === undefined || plugin.router instanceof Router)
  );
}
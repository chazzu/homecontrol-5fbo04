// @ts-check
import { ReactNode } from 'react'; // v18.0.0

/**
 * Represents the possible states of a plugin in the frontend
 */
export enum PluginState {
  LOADING = 'loading',
  ACTIVE = 'active',
  ERROR = 'error',
  DISABLED = 'disabled'
}

/**
 * Types of plugins supported by the dashboard
 */
export enum PluginType {
  ENTITY_COMPONENT = 'entity_component',
  ICON_PACK = 'icon_pack',
  UTILITY = 'utility'
}

/**
 * Interface defining the structure of a plugin manifest
 */
export interface PluginManifest {
  /** Unique identifier for the plugin */
  id: string;
  
  /** Display name of the plugin */
  name: string;
  
  /** Semantic version of the plugin */
  version: string;
  
  /** Type of plugin */
  type: PluginType;
  
  /** Path to plugin entry point script */
  entryPoint: string;
  
  /** Brief description of plugin functionality */
  description: string;
  
  /** Plugin author information */
  author: string;
}

/**
 * Interface for plugin configuration
 */
export interface PluginConfig {
  /** Whether plugin is enabled */
  enabled: boolean;
  
  /** Plugin-specific settings */
  settings: Record<string, unknown>;
}

/**
 * Type for plugin loading configuration
 */
export type PluginLoadOptions = {
  /** Maximum time allowed for plugin load in ms */
  timeout: number;
  
  /** Number of retry attempts on load failure */
  retryAttempts: number;
  
  /** Whether to validate plugin manifest */
  validateManifest: boolean;
};

/**
 * Type for plugin error codes
 */
export type PluginErrorCode = 
  | 'MANIFEST_INVALID'
  | 'LOAD_TIMEOUT'
  | 'ENTRY_POINT_ERROR'
  | 'RUNTIME_ERROR';

/**
 * Type for plugin loading errors
 */
export type PluginLoadError = {
  /** Error code */
  code: PluginErrorCode;
  
  /** Error message */
  message: string;
  
  /** ID of plugin that encountered error */
  pluginId: string;
  
  /** Additional error details */
  details: unknown;
};
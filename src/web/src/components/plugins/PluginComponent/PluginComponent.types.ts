/**
 * @file PluginComponent Type Definitions
 * @version 1.0.0
 * 
 * Type definitions for the dynamic plugin component system, providing strict type safety
 * and comprehensive interfaces for plugin loading, rendering, and error handling.
 */

import { ReactNode } from 'react'; // v18.0.0
import { PluginManifest, PluginType, PluginState, PluginLoadError } from '../../../types/plugin.types';
import { EntityType, EntityConfig } from '../../../types/entity.types';

/**
 * Props interface for the PluginComponent with strict type checking
 */
export interface PluginComponentProps {
  /** Plugin manifest containing metadata and configuration */
  manifest: PluginManifest;
  
  /** Entity type this plugin component handles */
  entityType?: EntityType;
  
  /** Optional entity configuration for entity-specific plugins */
  entityConfig?: EntityConfig;
  
  /** Optional child components to render within plugin */
  children?: ReactNode;
  
  /** Callback function for handling plugin errors */
  onError: (error: PluginLoadError) => void;
  
  /** Optional callback for plugin state changes */
  onStateChange?: (state: PluginState) => void;
  
  /** Optional plugin-specific configuration */
  pluginConfig?: Record<string, unknown>;
}

/**
 * Interface defining the internal state of the PluginComponent
 */
export interface PluginComponentState {
  /** Flag indicating if plugin is currently loading */
  isLoading: boolean;
  
  /** Current plugin state */
  pluginState: PluginState;
  
  /** Error object for plugin failures */
  error: PluginLoadError | null;
  
  /** Loaded plugin component instance */
  component: JSX.Element | null;
  
  /** Plugin load timestamp */
  loadTimestamp: number | null;
}

/**
 * Interface for plugin lifecycle hooks
 */
export interface PluginLifecycleHooks {
  /** Called when plugin is initialized */
  onInit?: () => Promise<void>;
  
  /** Called when plugin is mounted */
  onMount?: () => void;
  
  /** Called when plugin is unmounted */
  onUnmount?: () => void;
  
  /** Called when plugin encounters an error */
  onError?: (error: PluginLoadError) => void;
}

/**
 * Type definition for plugin render function
 */
export type PluginRenderFunction = (props: PluginComponentProps) => JSX.Element;

/**
 * Interface for plugin module exports
 */
export interface PluginModule {
  /** Plugin manifest */
  manifest: PluginManifest;
  
  /** Plugin render function */
  render: PluginRenderFunction;
  
  /** Optional lifecycle hooks */
  lifecycle?: PluginLifecycleHooks;
  
  /** Supported entity types for entity components */
  supportedEntityTypes?: EntityType[];
}

/**
 * Type guard to check if a plugin is an entity component
 */
export function isEntityComponentPlugin(manifest: PluginManifest): boolean {
  return manifest.type === PluginType.ENTITY_COMPONENT;
}

/**
 * Type guard to check if a plugin supports a specific entity type
 */
export function supportsEntityType(
  plugin: PluginModule,
  entityType: EntityType
): boolean {
  return plugin.supportedEntityTypes?.includes(entityType) ?? false;
}

/**
 * Type for plugin validation result
 */
export type PluginValidationResult = {
  /** Validation success flag */
  isValid: boolean;
  
  /** Validation errors if any */
  errors: string[];
  
  /** Plugin manifest if validation successful */
  manifest?: PluginManifest;
};

/**
 * Type for plugin loading options
 */
export type PluginLoadOptions = {
  /** Timeout duration in milliseconds */
  timeout?: number;
  
  /** Whether to validate plugin manifest */
  validateManifest?: boolean;
  
  /** Whether to enable strict mode */
  strict?: boolean;
  
  /** Custom error handler */
  errorHandler?: (error: PluginLoadError) => void;
};
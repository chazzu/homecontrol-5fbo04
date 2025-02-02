import { ReactNode } from 'react'; // v18.0.0
import { PluginManifest, PluginLoadError } from '../../../types/plugin.types';

/**
 * Props interface for the PluginLoader component
 * Provides configuration and callbacks for plugin loading with performance monitoring
 */
export interface PluginLoaderProps {
  /** Plugin manifest containing metadata and configuration */
  manifest: PluginManifest;
  
  /** Callback function called when plugin loads successfully with load time metrics */
  onLoad: (plugin: unknown, loadTime: number) => void;
  
  /** Callback function called when plugin loading fails */
  onError: (error: PluginLoadError) => void;
  
  /** React children to render when plugin is loaded */
  children?: ReactNode;
  
  /** Maximum allowed time for plugin loading in milliseconds. Default: 500ms */
  loadTimeout?: number;
}

/**
 * Internal state interface for the PluginLoader component
 * Tracks loading state and performance metrics
 */
export interface PluginLoaderState {
  /** Flag indicating if plugin is currently loading */
  isLoading: boolean;
  
  /** Error object if plugin loading failed, null otherwise */
  error: PluginLoadError | null;
  
  /** Timestamp when plugin loading started for performance tracking */
  startTime: number;
  
  /** Time taken to load plugin in milliseconds */
  loadTime: number | null;
  
  /** ID of the timeout timer for load time monitoring */
  timeoutId: number | null;
}

/**
 * Interface for comprehensive plugin load performance metrics
 * Used for monitoring and analyzing plugin loading performance
 */
export interface PluginLoadMetrics {
  /** Unique identifier of the plugin */
  pluginId: string;
  
  /** Time taken to load the plugin in milliseconds */
  loadTime: number;
  
  /** Timestamp when the plugin load completed */
  timestamp: number;
  
  /** Whether the plugin loaded successfully */
  success: boolean;
}

/**
 * Type guard to check if a plugin load error has occurred
 */
export function isPluginLoadError(error: unknown): error is PluginLoadError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'pluginId' in error &&
    'details' in error
  );
}

/**
 * Type for plugin load status tracking
 * Used for internal state management and progress monitoring
 */
export type PluginLoadStatus = {
  /** Current loading phase */
  phase: 'init' | 'loading' | 'complete' | 'error';
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Timestamp of last status update */
  lastUpdate: number;
};
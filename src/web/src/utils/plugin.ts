import { z } from 'zod'; // v3.0.0
import { performance } from 'perf_hooks'; // v1.0.0
import { PluginManifest, PluginState, PluginType } from '../types/plugin.types';
import { validatePluginManifest } from './validation';
import { getStorageItem, setStorageItem } from './storage';

// Constants for plugin management
const PLUGIN_LOAD_TIMEOUT = 500; // ms
const MAX_RETRY_ATTEMPTS = 3;
const PLUGIN_STORAGE_KEY = 'plugin_data';
const PLUGIN_VERSION_REGEX = /^\d+\.\d+\.\d+$/;
const PLUGIN_SECURITY_LEVEL = 'strict';

// Plugin-specific error types
class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public pluginId: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

// Plugin load options interface
interface PluginLoadOptions {
  timeout?: number;
  retryAttempts?: number;
  validateManifest?: boolean;
  securityLevel?: 'strict' | 'moderate' | 'relaxed';
}

// Plugin load result interface
interface PluginLoadResult {
  success: boolean;
  pluginId: string;
  state: PluginState;
  loadTime: number;
  error?: PluginError;
  metrics: {
    validationTime: number;
    loadTime: number;
    initializationTime: number;
    totalTime: number;
  };
}

// Plugin runtime registry
const pluginRegistry = new Map<string, {
  manifest: PluginManifest;
  instance: any;
  state: PluginState;
  loadTime: number;
}>();

/**
 * Performance monitoring decorator
 */
function performanceMonitor(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      if (duration > PLUGIN_LOAD_TIMEOUT) {
        console.warn(`Performance warning: ${propertyKey} took ${duration}ms`);
      }
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`${propertyKey} failed after ${duration}ms:`, error);
      throw error;
    }
  };
  return descriptor;
}

/**
 * Validates plugin compatibility with current dashboard version
 */
export const validatePluginCompatibility = async (
  manifest: PluginManifest,
  options: { strictVersionCheck?: boolean } = {}
): Promise<boolean> => {
  const { strictVersionCheck = true } = options;

  // Version validation
  if (!PLUGIN_VERSION_REGEX.test(manifest.version)) {
    throw new PluginError(
      'Invalid plugin version format',
      'INVALID_VERSION',
      manifest.id,
      { version: manifest.version }
    );
  }

  // Type validation
  if (!Object.values(PluginType).includes(manifest.type)) {
    throw new PluginError(
      'Unsupported plugin type',
      'INVALID_TYPE',
      manifest.id,
      { type: manifest.type }
    );
  }

  // Entry point validation
  if (!manifest.entryPoint.startsWith('./')) {
    throw new PluginError(
      'Invalid entry point path',
      'INVALID_ENTRY_POINT',
      manifest.id,
      { entryPoint: manifest.entryPoint }
    );
  }

  return true;
};

/**
 * Loads a plugin with enhanced security and performance monitoring
 */
@performanceMonitor
export const loadPlugin = async (
  manifest: PluginManifest,
  options: PluginLoadOptions = {}
): Promise<PluginLoadResult> => {
  const startTime = performance.now();
  const metrics = {
    validationTime: 0,
    loadTime: 0,
    initializationTime: 0,
    totalTime: 0
  };

  try {
    // Validate options
    const {
      timeout = PLUGIN_LOAD_TIMEOUT,
      retryAttempts = MAX_RETRY_ATTEMPTS,
      validateManifest = true,
      securityLevel = PLUGIN_SECURITY_LEVEL
    } = options;

    // Manifest validation
    if (validateManifest) {
      const validationStart = performance.now();
      await validatePluginManifest(manifest);
      await validatePluginCompatibility(manifest);
      metrics.validationTime = performance.now() - validationStart;
    }

    // Check if plugin is already loaded
    if (pluginRegistry.has(manifest.id)) {
      throw new PluginError(
        'Plugin already loaded',
        'PLUGIN_ALREADY_LOADED',
        manifest.id
      );
    }

    // Load plugin with retry mechanism
    const loadStart = performance.now();
    let plugin;
    let attempts = 0;
    while (attempts < retryAttempts) {
      try {
        plugin = await Promise.race([
          import(/* @vite-ignore */ manifest.entryPoint),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Load timeout')), timeout)
          )
        ]);
        break;
      } catch (error) {
        attempts++;
        if (attempts === retryAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    metrics.loadTime = performance.now() - loadStart;

    // Initialize plugin
    const initStart = performance.now();
    const instance = await plugin.default.initialize({
      manifest,
      securityLevel
    });
    metrics.initializationTime = performance.now() - initStart;

    // Register plugin
    pluginRegistry.set(manifest.id, {
      manifest,
      instance,
      state: PluginState.ACTIVE,
      loadTime: performance.now() - startTime
    });

    // Store plugin data
    const pluginData = getStorageItem<Record<string, PluginManifest>>(
      PLUGIN_STORAGE_KEY,
      {}
    );
    pluginData[manifest.id] = manifest;
    setStorageItem(PLUGIN_STORAGE_KEY, pluginData);

    metrics.totalTime = performance.now() - startTime;
    return {
      success: true,
      pluginId: manifest.id,
      state: PluginState.ACTIVE,
      loadTime: metrics.totalTime,
      metrics
    };
  } catch (error) {
    const errorResult: PluginLoadResult = {
      success: false,
      pluginId: manifest.id,
      state: PluginState.ERROR,
      loadTime: performance.now() - startTime,
      error: error instanceof PluginError ? error : new PluginError(
        'Plugin load failed',
        'LOAD_FAILED',
        manifest.id,
        { originalError: error }
      ),
      metrics
    };
    return errorResult;
  }
};

/**
 * Safely unloads a plugin with resource cleanup
 */
@performanceMonitor
export const unloadPlugin = async (
  pluginId: string,
  options: { force?: boolean } = {}
): Promise<void> => {
  const { force = false } = options;

  const plugin = pluginRegistry.get(pluginId);
  if (!plugin && !force) {
    throw new PluginError(
      'Plugin not found',
      'PLUGIN_NOT_FOUND',
      pluginId
    );
  }

  try {
    // Execute plugin cleanup
    if (plugin?.instance?.cleanup) {
      await plugin.instance.cleanup();
    }

    // Remove from registry
    pluginRegistry.delete(pluginId);

    // Remove from storage
    const pluginData = getStorageItem<Record<string, PluginManifest>>(
      PLUGIN_STORAGE_KEY,
      {}
    );
    delete pluginData[pluginId];
    setStorageItem(PLUGIN_STORAGE_KEY, pluginData);

    // Emit unload event
    window.dispatchEvent(
      new CustomEvent('pluginUnloaded', { detail: { pluginId } })
    );
  } catch (error) {
    throw new PluginError(
      'Plugin unload failed',
      'UNLOAD_FAILED',
      pluginId,
      { originalError: error }
    );
  }
};
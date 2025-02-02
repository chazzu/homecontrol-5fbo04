import React, { useEffect, useState, useCallback } from 'react'; // ^18.0.0
import { performance } from 'perf_hooks'; // ^1.0.0
import { PluginLoaderProps, PluginLoadMetrics, isPluginLoadError } from './PluginLoader.types';
import { usePlugin } from '../../../hooks/usePlugin';
import { PluginState, PluginLoadError } from '../../../types/plugin.types';

// Performance monitoring constants
const PLUGIN_LOAD_TIMEOUT = 500; // Maximum load time in ms
const PLUGIN_LOAD_RETRY_ATTEMPTS = 3;
const PLUGIN_LOAD_RETRY_DELAY = 1000; // Retry delay in ms

/**
 * PluginLoader component handles dynamic loading of plugins with performance monitoring
 * and security validation.
 */
export const PluginLoader: React.FC<PluginLoaderProps> = ({
  manifest,
  onLoad,
  onError,
  children,
  loadTimeout = PLUGIN_LOAD_TIMEOUT
}) => {
  // Component state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<PluginLoadError | null>(null);
  const [loadStartTime, setLoadStartTime] = useState(0);
  const [loadMetrics, setLoadMetrics] = useState<PluginLoadMetrics | null>(null);

  // Plugin management hook
  const {
    loadPlugin,
    validatePlugin,
    pluginStates,
    getPluginErrors
  } = usePlugin();

  /**
   * Handles successful plugin loading with performance metrics
   */
  const handlePluginLoad = useCallback(async (plugin: unknown) => {
    const loadTime = performance.now() - loadStartTime;

    // Log performance warning if load time exceeds threshold
    if (loadTime > PLUGIN_LOAD_TIMEOUT) {
      console.warn(
        `Plugin ${manifest.id} load time (${loadTime}ms) exceeded threshold (${PLUGIN_LOAD_TIMEOUT}ms)`
      );
    }

    // Record performance metrics
    const metrics: PluginLoadMetrics = {
      pluginId: manifest.id,
      loadTime,
      timestamp: Date.now(),
      success: true
    };
    setLoadMetrics(metrics);

    // Update component state
    setIsLoading(false);
    setError(null);

    // Notify parent component
    onLoad(plugin, loadTime);
  }, [manifest.id, loadStartTime, onLoad]);

  /**
   * Handles plugin loading errors with detailed reporting
   */
  const handlePluginError = useCallback((error: unknown) => {
    const loadTime = performance.now() - loadStartTime;
    
    // Generate detailed error report
    const pluginError: PluginLoadError = isPluginLoadError(error) ? error : {
      code: 'LOAD_TIMEOUT',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      pluginId: manifest.id,
      details: {
        loadTime,
        manifest,
        error
      }
    };

    // Update component state
    setIsLoading(false);
    setError(pluginError);

    // Record error metrics
    const metrics: PluginLoadMetrics = {
      pluginId: manifest.id,
      loadTime,
      timestamp: Date.now(),
      success: false
    };
    setLoadMetrics(metrics);

    // Notify parent component
    onError(pluginError);
  }, [manifest, loadStartTime, onError]);

  /**
   * Attempts to load plugin with retry logic
   */
  const attemptPluginLoad = useCallback(async (retryCount = 0) => {
    try {
      // Validate plugin manifest
      if (!validatePlugin(manifest)) {
        throw new Error(`Invalid plugin manifest for ${manifest.id}`);
      }

      // Start performance monitoring
      setLoadStartTime(performance.now());

      // Attempt to load plugin
      await loadPlugin(manifest, {
        timeout: loadTimeout,
        retryAttempts: PLUGIN_LOAD_RETRY_ATTEMPTS,
        validateManifest: true
      });

      // Check if plugin loaded successfully
      const pluginState = pluginStates.get(manifest.id);
      if (pluginState === PluginState.ERROR) {
        const errors = getPluginErrors(manifest.id);
        throw errors[0] || new Error('Plugin failed to load');
      }

      // Handle successful load
      handlePluginLoad(manifest);

    } catch (error) {
      // Implement retry logic
      if (retryCount < PLUGIN_LOAD_RETRY_ATTEMPTS) {
        console.warn(`Retrying plugin load for ${manifest.id}, attempt ${retryCount + 1}`);
        setTimeout(() => {
          attemptPluginLoad(retryCount + 1);
        }, PLUGIN_LOAD_RETRY_DELAY);
      } else {
        handlePluginError(error);
      }
    }
  }, [manifest, loadTimeout, loadPlugin, pluginStates, getPluginErrors, handlePluginLoad, handlePluginError, validatePlugin]);

  // Initialize plugin loading
  useEffect(() => {
    attemptPluginLoad();

    // Cleanup function
    return () => {
      setIsLoading(false);
      setLoadStartTime(0);
    };
  }, [attemptPluginLoad]);

  // Render loading state
  if (isLoading) {
    return (
      <div role="alert" aria-busy="true" aria-label={`Loading plugin ${manifest.name}`}>
        <span className="sr-only">Loading plugin {manifest.name}</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div role="alert" aria-live="polite">
        <div className="plugin-error">
          <h3>Failed to load plugin: {manifest.name}</h3>
          <p>{error.message}</p>
          {process.env.NODE_ENV === 'development' && (
            <pre>{JSON.stringify(error.details, null, 2)}</pre>
          )}
        </div>
      </div>
    );
  }

  // Render success state
  return (
    <div 
      role="region" 
      aria-label={`Plugin: ${manifest.name}`}
      data-plugin-id={manifest.id}
      data-load-time={loadMetrics?.loadTime}
    >
      {children}
    </div>
  );
};

export default PluginLoader;
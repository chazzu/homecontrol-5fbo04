import React, { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { PluginComponentProps, PluginComponentState } from './PluginComponent.types';
import { usePlugin } from '../../../hooks/usePlugin';
import { PluginState, PluginLoadError } from '../../../types/plugin.types';

/**
 * Performance monitoring constants
 */
const PERFORMANCE_CONFIG = {
  LOAD_TIMEOUT: 500, // ms
  MEMORY_LIMIT: 50 * 1024 * 1024, // 50MB
  RENDER_THRESHOLD: 16 // ms (60fps target)
} as const;

/**
 * Enhanced plugin component with security measures and performance monitoring
 */
const PluginComponent: React.FC<PluginComponentProps> = React.memo(({
  manifest,
  entityType,
  entityConfig,
  children,
  onError,
  onStateChange,
  pluginConfig
}) => {
  // Component state
  const [state, setState] = useState<PluginComponentState>({
    isLoading: true,
    pluginState: PluginState.LOADING,
    error: null,
    component: null,
    loadTimestamp: null
  });

  // Performance monitoring refs
  const renderStartTime = useRef<number>(0);
  const memoryUsage = useRef<number>(0);
  const loadTimeout = useRef<NodeJS.Timeout>();

  // Get enhanced plugin management functions
  const {
    loadPlugin,
    unloadPlugin,
    getPluginComponent,
    validatePlugin,
    getPluginMetrics,
    isPluginActive
  } = usePlugin();

  /**
   * Enhanced error handler with detailed logging
   */
  const handleError = useCallback((error: Error, context: string) => {
    console.error(`Plugin Error [${manifest.id}] - ${context}:`, error);
    
    const pluginError: PluginLoadError = {
      code: 'RUNTIME_ERROR',
      message: error.message,
      pluginId: manifest.id,
      details: {
        context,
        stack: error.stack,
        timestamp: Date.now()
      }
    };

    setState(prev => ({
      ...prev,
      error: pluginError,
      pluginState: PluginState.ERROR
    }));

    onError?.(pluginError);
  }, [manifest.id, onError]);

  /**
   * Performance monitoring function
   */
  const monitorPerformance = useCallback(() => {
    const currentRenderTime = performance.now() - renderStartTime.current;
    const currentMemoryUsage = performance.memory?.usedJSHeapSize || 0;

    // Check performance thresholds
    if (currentRenderTime > PERFORMANCE_CONFIG.RENDER_THRESHOLD) {
      console.warn(`Plugin ${manifest.id} render time exceeded threshold: ${currentRenderTime}ms`);
    }

    if (currentMemoryUsage > PERFORMANCE_CONFIG.MEMORY_LIMIT) {
      handleError(
        new Error(`Memory usage exceeded limit: ${currentMemoryUsage} bytes`),
        'Performance Monitor'
      );
    }

    memoryUsage.current = currentMemoryUsage;
  }, [manifest.id, handleError]);

  /**
   * Initialize plugin with security validation and performance monitoring
   */
  const initializePlugin = useCallback(async () => {
    try {
      // Validate plugin manifest
      if (!validatePlugin(manifest)) {
        throw new Error('Invalid plugin manifest');
      }

      // Set load timestamp
      const loadStartTime = Date.now();
      setState(prev => ({ ...prev, loadTimestamp: loadStartTime }));

      // Set load timeout
      loadTimeout.current = setTimeout(() => {
        handleError(
          new Error(`Plugin load timeout after ${PERFORMANCE_CONFIG.LOAD_TIMEOUT}ms`),
          'Load Timeout'
        );
      }, PERFORMANCE_CONFIG.LOAD_TIMEOUT);

      // Load plugin with enhanced security
      await loadPlugin(manifest, {
        validateManifest: true,
        timeout: PERFORMANCE_CONFIG.LOAD_TIMEOUT,
        strict: true,
        errorHandler: (error) => handleError(error, 'Plugin Load')
      });

      // Get plugin component
      const pluginComponent = getPluginComponent(manifest.id, manifest.type);
      
      // Clear timeout on successful load
      clearTimeout(loadTimeout.current);

      // Update state with loaded component
      setState(prev => ({
        ...prev,
        isLoading: false,
        pluginState: PluginState.ACTIVE,
        component: pluginComponent,
        error: null
      }));

      // Notify state change
      onStateChange?.(PluginState.ACTIVE);

    } catch (error) {
      handleError(error, 'Plugin Initialization');
    }
  }, [
    manifest,
    loadPlugin,
    getPluginComponent,
    validatePlugin,
    handleError,
    onStateChange
  ]);

  /**
   * Cleanup plugin resources
   */
  const cleanupPlugin = useCallback(async () => {
    try {
      if (isPluginActive(manifest.id)) {
        await unloadPlugin(manifest.id);
        onStateChange?.(PluginState.DISABLED);
      }
    } catch (error) {
      handleError(error, 'Plugin Cleanup');
    }
  }, [manifest.id, unloadPlugin, isPluginActive, onStateChange, handleError]);

  // Initialize plugin on mount
  useEffect(() => {
    initializePlugin();

    // Cleanup on unmount
    return () => {
      clearTimeout(loadTimeout.current);
      cleanupPlugin();
    };
  }, [initializePlugin, cleanupPlugin]);

  // Performance monitoring effect
  useEffect(() => {
    if (state.pluginState === PluginState.ACTIVE) {
      renderStartTime.current = performance.now();
      
      // Monitor performance after each render
      const rafId = requestAnimationFrame(monitorPerformance);
      
      return () => cancelAnimationFrame(rafId);
    }
  }, [state.pluginState, monitorPerformance]);

  // Render appropriate UI based on plugin state
  if (state.isLoading) {
    return (
      <div className="plugin-loading" role="alert" aria-busy="true">
        Loading plugin: {manifest.name}...
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="plugin-error" role="alert">
        <h3>Plugin Error: {manifest.name}</h3>
        <p>{state.error.message}</p>
      </div>
    );
  }

  if (!state.component) {
    return null;
  }

  // Render plugin component with props
  return React.createElement(state.component, {
    entityType,
    entityConfig,
    pluginConfig,
    children
  });
});

PluginComponent.displayName = 'PluginComponent';

export default PluginComponent;
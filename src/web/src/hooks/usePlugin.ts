import { useContext, useCallback, useEffect } from 'react'; // ^18.0.0
import { performance } from 'perf_hooks'; // ^1.0.0
import { PluginContext } from '../contexts/PluginContext';
import { PluginManifest, PluginState, PluginType } from '../types/plugin.types';

/**
 * Enhanced custom hook for managing plugins with performance monitoring and improved error handling
 * @returns Object containing plugin management functions and state with performance metrics
 */
export const usePlugin = () => {
  const context = useContext(PluginContext);

  // Validate context exists
  if (!context) {
    throw new Error('usePlugin must be used within a PluginProvider');
  }

  const {
    plugins,
    pluginStates,
    pluginMetrics,
    pluginErrors,
    loadPlugin,
    unloadPlugin,
    getPluginMetrics,
    isPluginActive
  } = context;

  // Enhanced plugin loading with performance tracking
  const loadPluginWithMetrics = useCallback(async (
    manifest: PluginManifest,
    options = {}
  ) => {
    const startTime = performance.now();

    try {
      await loadPlugin(manifest, {
        ...options,
        timeout: 5000, // 5 second timeout
        retryAttempts: 3,
        validateManifest: true
      });

      const loadTime = performance.now() - startTime;
      
      // Validate load time against performance threshold
      if (loadTime > 500) {
        console.warn(`Plugin ${manifest.id} load time exceeded threshold: ${loadTime}ms`);
      }

    } catch (error) {
      console.error(`Failed to load plugin ${manifest.id}:`, error);
      throw error;
    }
  }, [loadPlugin]);

  // Enhanced plugin unloading with cleanup
  const unloadPluginSafely = useCallback(async (pluginId: string) => {
    try {
      // Check if plugin is active before unloading
      if (isPluginActive(pluginId)) {
        await unloadPlugin(pluginId);
      }
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      throw error;
    }
  }, [unloadPlugin, isPluginActive]);

  // Get plugin component with type validation
  const getPluginComponent = useCallback((
    pluginId: string,
    type: PluginType
  ) => {
    const plugin = plugins.get(pluginId);
    
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.type !== type) {
      throw new Error(`Plugin ${pluginId} is not of type ${type}`);
    }

    return plugin;
  }, [plugins]);

  // Validate plugin manifest and dependencies
  const validatePlugin = useCallback((manifest: PluginManifest): boolean => {
    // Validate required fields
    if (!manifest.id || !manifest.version || !manifest.type) {
      return false;
    }

    // Validate version format (semver)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(manifest.version)) {
      return false;
    }

    // Validate plugin type
    if (!Object.values(PluginType).includes(manifest.type)) {
      return false;
    }

    return true;
  }, []);

  // Cleanup effect for active plugins
  useEffect(() => {
    return () => {
      // Cleanup all active plugins on unmount
      plugins.forEach((plugin, pluginId) => {
        if (isPluginActive(pluginId)) {
          unloadPluginSafely(pluginId).catch(console.error);
        }
      });
    };
  }, [plugins, unloadPluginSafely, isPluginActive]);

  return {
    // Plugin state
    plugins,
    pluginStates,
    
    // Enhanced functions
    loadPlugin: loadPluginWithMetrics,
    unloadPlugin: unloadPluginSafely,
    getPluginComponent,
    
    // Performance monitoring
    getPluginMetrics,
    
    // Validation
    validatePlugin,
    
    // Helper functions
    isPluginActive: useCallback((pluginId: string) => 
      pluginStates.get(pluginId) === PluginState.ACTIVE,
    [pluginStates]),
    
    hasPlugin: useCallback((pluginId: string) => 
      plugins.has(pluginId),
    [plugins]),
    
    getPluginErrors: useCallback((pluginId: string) => 
      pluginErrors.get(pluginId) || [],
    [pluginErrors])
  };
};

export default usePlugin;
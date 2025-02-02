import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'; // ^18.0.0
import { usePerformance } from '@react-hook/performance'; // ^1.0.0
import { 
  PluginManifest, 
  PluginState, 
  PluginLoadError, 
  PluginLoadOptions,
  PluginType
} from '../types/plugin.types';

// Performance and security configuration constants
const PLUGIN_SECURITY_CONFIG = {
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  loadTimeout: 5000, // 5 seconds
  maxRetries: 3,
  requiredPermissions: ['storage', 'network'] as const
} as const;

const PLUGIN_PERFORMANCE_THRESHOLDS = {
  loadTime: 500, // ms
  memoryLimit: 50 * 1024 * 1024, // 50MB
  renderTime: 16 // ms (target 60fps)
} as const;

// Plugin metrics interface
interface PluginMetrics {
  loadTime: number;
  memoryUsage: number;
  renderTime: number;
  lastUpdated: number;
}

// Enhanced context interface with security and performance features
interface PluginContextType {
  plugins: Map<string, PluginManifest>;
  pluginStates: Map<string, PluginState>;
  pluginMetrics: Map<string, PluginMetrics>;
  pluginErrors: Map<string, PluginLoadError[]>;
  loadPlugin: (manifest: PluginManifest, options?: Partial<PluginLoadOptions>) => Promise<void>;
  unloadPlugin: (pluginId: string) => Promise<void>;
  getPluginMetrics: (pluginId: string) => PluginMetrics | undefined;
  isPluginActive: (pluginId: string) => boolean;
}

// Create context with default values
const PluginContext = createContext<PluginContextType>({
  plugins: new Map(),
  pluginStates: new Map(),
  pluginMetrics: new Map(),
  pluginErrors: new Map(),
  loadPlugin: async () => {},
  unloadPlugin: async () => {},
  getPluginMetrics: () => undefined,
  isPluginActive: () => false
});

// Security validation function
const validatePluginSecurity = async (manifest: PluginManifest): Promise<boolean> => {
  try {
    // Verify plugin signature (placeholder for actual implementation)
    const isSignatureValid = await verifyPluginSignature(manifest);
    if (!isSignatureValid) return false;

    // Check permissions
    const hasValidPermissions = manifest.permissions?.every(
      permission => PLUGIN_SECURITY_CONFIG.requiredPermissions.includes(permission)
    );
    if (!hasValidPermissions) return false;

    // Validate dependencies
    if (manifest.dependencies?.length) {
      const areDependenciesValid = await validateDependencies(manifest.dependencies);
      if (!areDependenciesValid) return false;
    }

    return true;
  } catch (error) {
    console.error(`Security validation failed for plugin ${manifest.id}:`, error);
    return false;
  }
};

// Performance monitoring hook
const usePluginPerformance = (pluginId: string) => {
  const performance = usePerformance();
  
  return useCallback((metric: keyof PluginMetrics) => {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      return {
        metric,
        duration,
        timestamp: Date.now()
      };
    };
  }, [performance, pluginId]);
};

// Plugin Provider Component
export const PluginProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plugins, setPlugins] = useState<Map<string, PluginManifest>>(new Map());
  const [pluginStates, setPluginStates] = useState<Map<string, PluginState>>(new Map());
  const [pluginMetrics, setPluginMetrics] = useState<Map<string, PluginMetrics>>(new Map());
  const [pluginErrors, setPluginErrors] = useState<Map<string, PluginLoadError[]>>(new Map());

  // Load plugin implementation
  const loadPlugin = useCallback(async (
    manifest: PluginManifest,
    options: Partial<PluginLoadOptions> = {}
  ) => {
    const pluginId = manifest.id;
    const measurePerformance = usePluginPerformance(pluginId);

    try {
      // Update plugin state to loading
      setPluginStates(prev => new Map(prev).set(pluginId, PluginState.LOADING));

      // Validate plugin security
      const isSecure = await validatePluginSecurity(manifest);
      if (!isSecure) {
        throw new Error('Plugin security validation failed');
      }

      // Measure load time
      const endLoadMeasurement = measurePerformance('loadTime');

      // Dynamic import of plugin
      const pluginModule = await import(/* @vite-ignore */ manifest.entryPoint);
      
      // Record load metrics
      const loadMetrics = endLoadMeasurement();
      
      // Initialize plugin in sandbox
      const sandbox = await createPluginSandbox(manifest);
      await sandbox.initialize(pluginModule);

      // Update plugin state and metrics
      setPlugins(prev => new Map(prev).set(pluginId, manifest));
      setPluginStates(prev => new Map(prev).set(pluginId, PluginState.ACTIVE));
      setPluginMetrics(prev => new Map(prev).set(pluginId, {
        loadTime: loadMetrics.duration,
        memoryUsage: sandbox.getMemoryUsage(),
        renderTime: 0,
        lastUpdated: Date.now()
      }));

    } catch (error) {
      const pluginError: PluginLoadError = {
        code: 'LOAD_TIMEOUT',
        message: error.message,
        pluginId,
        details: error
      };

      setPluginStates(prev => new Map(prev).set(pluginId, PluginState.ERROR));
      setPluginErrors(prev => {
        const errors = prev.get(pluginId) || [];
        return new Map(prev).set(pluginId, [...errors, pluginError]);
      });

      throw error;
    }
  }, []);

  // Unload plugin implementation
  const unloadPlugin = useCallback(async (pluginId: string) => {
    try {
      setPluginStates(prev => new Map(prev).set(pluginId, PluginState.UNLOADING));
      
      // Cleanup plugin resources
      const sandbox = await getPluginSandbox(pluginId);
      await sandbox.cleanup();

      // Remove plugin from state
      setPlugins(prev => {
        const newPlugins = new Map(prev);
        newPlugins.delete(pluginId);
        return newPlugins;
      });
      setPluginStates(prev => {
        const newStates = new Map(prev);
        newStates.delete(pluginId);
        return newStates;
      });
      setPluginMetrics(prev => {
        const newMetrics = new Map(prev);
        newMetrics.delete(pluginId);
        return newMetrics;
      });

    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      throw error;
    }
  }, []);

  // Plugin metrics getter
  const getPluginMetrics = useCallback((pluginId: string) => {
    return pluginMetrics.get(pluginId);
  }, [pluginMetrics]);

  // Plugin active state checker
  const isPluginActive = useCallback((pluginId: string) => {
    return pluginStates.get(pluginId) === PluginState.ACTIVE;
  }, [pluginStates]);

  // Context value
  const value = useMemo(() => ({
    plugins,
    pluginStates,
    pluginMetrics,
    pluginErrors,
    loadPlugin,
    unloadPlugin,
    getPluginMetrics,
    isPluginActive
  }), [
    plugins,
    pluginStates,
    pluginMetrics,
    pluginErrors,
    loadPlugin,
    unloadPlugin,
    getPluginMetrics,
    isPluginActive
  ]);

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
};

// Custom hooks for consuming context
export const usePluginContext = () => {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePluginContext must be used within a PluginProvider');
  }
  return context;
};

export const usePluginMetrics = (pluginId: string) => {
  const { getPluginMetrics } = usePluginContext();
  return useMemo(() => getPluginMetrics(pluginId), [getPluginMetrics, pluginId]);
};

export const usePluginSecurity = (pluginId: string) => {
  const { plugins, pluginErrors } = usePluginContext();
  return useMemo(() => ({
    manifest: plugins.get(pluginId),
    errors: pluginErrors.get(pluginId) || []
  }), [plugins, pluginErrors, pluginId]);
};

// Helper functions (implementation details omitted for brevity)
async function verifyPluginSignature(manifest: PluginManifest): Promise<boolean> {
  // Implement actual signature verification
  return true;
}

async function validateDependencies(dependencies: string[]): Promise<boolean> {
  // Implement dependency validation
  return true;
}

async function createPluginSandbox(manifest: PluginManifest) {
  // Implement sandbox creation
  return {
    initialize: async (module: unknown) => {},
    cleanup: async () => {},
    getMemoryUsage: () => 0
  };
}

async function getPluginSandbox(pluginId: string) {
  // Implement sandbox retrieval
  return {
    cleanup: async () => {}
  };
}

export default PluginContext;
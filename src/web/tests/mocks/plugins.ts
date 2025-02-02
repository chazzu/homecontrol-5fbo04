import { PluginManifest, PluginLoadOptions, PluginLoadError, PluginType } from '../../src/types/plugin.types';

/**
 * Mock plugin manifests for testing plugin system functionality
 * @version 1.0.0
 */
export const mockPluginManifests: PluginManifest[] = [
  {
    id: 'custom-light-component',
    name: 'Custom Light Component',
    version: '1.0.0',
    type: PluginType.ENTITY_COMPONENT,
    entryPoint: '/plugins/custom-light/index.js',
    description: 'Custom visualization for light entities',
    author: 'Test Author'
  },
  {
    id: 'material-icons',
    name: 'Material Design Icons',
    version: '1.0.0',
    type: PluginType.ICON_PACK,
    entryPoint: '/plugins/material-icons/index.js',
    description: 'Material design icon pack for entities',
    author: 'Test Author'
  },
  {
    id: 'performance-monitor',
    name: 'Performance Monitor',
    version: '1.1.0',
    type: PluginType.UTILITY,
    entryPoint: '/plugins/performance-monitor/index.js',
    description: 'Plugin performance monitoring utility',
    author: 'Test Author'
  }
];

/**
 * Mock plugin configurations for testing plugin settings and state management
 */
export const mockPluginConfigs: Record<string, { enabled: boolean; settings: Record<string, unknown> }> = {
  'custom-light-component': {
    enabled: true,
    settings: {
      defaultBrightness: 100,
      animationEnabled: true,
      theme: 'modern',
      updateInterval: 1000,
      features: ['dimming', 'color', 'effects']
    }
  },
  'material-icons': {
    enabled: true,
    settings: {
      iconSize: 24,
      colorScheme: 'default',
      cacheDuration: 3600,
      preloadIcons: true
    }
  },
  'performance-monitor': {
    enabled: false,
    settings: {
      sampleRate: 1000,
      maxDataPoints: 100,
      alertThreshold: 80
    }
  }
};

/**
 * Mock plugin load options for testing loading behavior and performance
 */
export const mockPluginLoadOptions: Record<string, PluginLoadOptions> = {
  default: {
    timeout: 5000,
    retryAttempts: 3,
    validateManifest: true
  },
  performance: {
    timeout: 2000,
    retryAttempts: 1,
    validateManifest: true
  },
  development: {
    timeout: 10000,
    retryAttempts: 5,
    validateManifest: false
  }
};

/**
 * Mock plugin load errors for testing error handling scenarios
 */
export const mockPluginLoadErrors: Record<string, PluginLoadError> = {
  MANIFEST_INVALID: {
    code: 'MANIFEST_INVALID',
    message: 'Plugin manifest validation failed',
    pluginId: 'invalid-plugin',
    details: {
      missingFields: ['version', 'author'],
      invalidFields: {
        type: 'unsupported_type'
      }
    }
  },
  LOAD_TIMEOUT: {
    code: 'LOAD_TIMEOUT',
    message: 'Plugin failed to load within specified timeout',
    pluginId: 'slow-plugin',
    details: {
      timeout: 5000,
      actualLoadTime: 7500
    }
  },
  ENTRY_POINT_ERROR: {
    code: 'ENTRY_POINT_ERROR',
    message: 'Failed to load plugin entry point',
    pluginId: 'broken-plugin',
    details: {
      error: 'Module not found',
      path: '/plugins/broken-plugin/index.js'
    }
  },
  RUNTIME_ERROR: {
    code: 'RUNTIME_ERROR',
    message: 'Plugin runtime execution failed',
    pluginId: 'unstable-plugin',
    details: {
      error: 'Uncaught TypeError',
      stack: 'Error: Cannot read property of undefined'
    }
  }
};

/**
 * Mock plugin performance metrics for testing monitoring functionality
 */
export const mockPluginPerformanceMetrics: Record<string, {
  loadTime: number;
  memoryUsage: number;
  errorRate: number;
  lastUpdated: string;
}> = {
  'custom-light-component': {
    loadTime: 150,
    memoryUsage: 5120, // KB
    errorRate: 0.01,
    lastUpdated: new Date().toISOString()
  },
  'material-icons': {
    loadTime: 80,
    memoryUsage: 2048, // KB
    errorRate: 0,
    lastUpdated: new Date().toISOString()
  },
  'performance-monitor': {
    loadTime: 95,
    memoryUsage: 1536, // KB
    errorRate: 0.005,
    lastUpdated: new Date().toISOString()
  }
};
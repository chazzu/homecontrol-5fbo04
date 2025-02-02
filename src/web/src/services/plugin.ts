import axios from 'axios'; // v1.4.0
import { PluginManifest } from '../types/plugin.types';
import { loadPlugin, unloadPlugin, getPluginState } from '../utils/plugin';

// Constants for plugin management
const PLUGIN_API_TIMEOUT = 5000;
const PLUGIN_CONFIG_KEY = 'plugin_config';
const PLUGIN_LOAD_TIMEOUT = 500;
const PLUGIN_SECURITY_VERSION = '1.0.0';
const PLUGIN_CACHE_PREFIX = 'plugin_cache_';

// Custom error types for plugin operations
class PluginServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public pluginId: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PluginServiceError';
  }
}

// Plugin installation options interface
interface PluginInstallOptions {
  timeout?: number;
  validateManifest?: boolean;
  securityLevel?: 'strict' | 'moderate' | 'relaxed';
  cacheEnabled?: boolean;
  retryAttempts?: number;
}

// Performance monitoring decorator
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
        console.warn(`Plugin operation ${propertyKey} took ${duration}ms`);
      }
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`Plugin operation ${propertyKey} failed after ${duration}ms:`, error);
      throw error;
    }
  };
  return descriptor;
}

// Manifest validation decorator
function validateManifest(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(manifest: PluginManifest, ...args: any[]) {
    // Validate manifest structure
    if (!manifest.id || !manifest.version || !manifest.type) {
      throw new PluginServiceError(
        'Invalid plugin manifest structure',
        'INVALID_MANIFEST',
        manifest.id || 'unknown',
        { manifest }
      );
    }

    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(manifest.version)) {
      throw new PluginServiceError(
        'Invalid version format',
        'INVALID_VERSION',
        manifest.id,
        { version: manifest.version }
      );
    }

    // Validate security version compatibility
    const [manifestMajor] = manifest.version.split('.');
    const [securityMajor] = PLUGIN_SECURITY_VERSION.split('.');
    if (parseInt(manifestMajor) < parseInt(securityMajor)) {
      throw new PluginServiceError(
        'Plugin version incompatible with security requirements',
        'SECURITY_VERSION_MISMATCH',
        manifest.id,
        { 
          pluginVersion: manifest.version,
          requiredVersion: PLUGIN_SECURITY_VERSION
        }
      );
    }

    return originalMethod.apply(this, [manifest, ...args]);
  };
  return descriptor;
}

/**
 * Installs a plugin with enhanced security validation and performance monitoring
 */
@performanceMonitor
@validateManifest
export async function installPlugin(
  manifest: PluginManifest,
  options: PluginInstallOptions = {}
): Promise<boolean> {
  const {
    timeout = PLUGIN_API_TIMEOUT,
    validateManifest = true,
    securityLevel = 'strict',
    cacheEnabled = true,
    retryAttempts = 3
  } = options;

  try {
    // Check if plugin is already installed
    const existingState = await getPluginState(manifest.id);
    if (existingState) {
      throw new PluginServiceError(
        'Plugin already installed',
        'PLUGIN_EXISTS',
        manifest.id
      );
    }

    // Check cache if enabled
    if (cacheEnabled) {
      const cachedData = localStorage.getItem(`${PLUGIN_CACHE_PREFIX}${manifest.id}`);
      if (cachedData) {
        const cached = JSON.parse(cachedData);
        if (cached.version === manifest.version) {
          return loadPlugin(manifest, { timeout, validateManifest, securityLevel });
        }
      }
    }

    // Download plugin files
    const pluginFiles = await Promise.all(
      Object.entries(manifest.dependencies || {}).map(async ([path, url]) => {
        try {
          const response = await axios.get(url, {
            timeout,
            headers: {
              'Accept': 'application/javascript',
              'X-Plugin-Version': manifest.version,
              'X-Security-Version': PLUGIN_SECURITY_VERSION
            }
          });
          return { path, content: response.data };
        } catch (error) {
          throw new PluginServiceError(
            'Failed to download plugin dependency',
            'DOWNLOAD_ERROR',
            manifest.id,
            { path, url, error }
          );
        }
      })
    );

    // Validate downloaded files
    for (const file of pluginFiles) {
      if (typeof file.content !== 'string' || file.content.length === 0) {
        throw new PluginServiceError(
          'Invalid plugin file content',
          'INVALID_FILE',
          manifest.id,
          { file: file.path }
        );
      }
    }

    // Store plugin files
    if (cacheEnabled) {
      localStorage.setItem(
        `${PLUGIN_CACHE_PREFIX}${manifest.id}`,
        JSON.stringify({
          version: manifest.version,
          files: pluginFiles,
          timestamp: Date.now()
        })
      );
    }

    // Load plugin with retry mechanism
    let lastError;
    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const success = await loadPlugin(manifest, {
          timeout,
          validateManifest,
          securityLevel
        });
        
        // Store plugin configuration
        const config = {
          id: manifest.id,
          version: manifest.version,
          installDate: new Date().toISOString(),
          lastUpdate: new Date().toISOString()
        };
        localStorage.setItem(
          `${PLUGIN_CONFIG_KEY}_${manifest.id}`,
          JSON.stringify(config)
        );

        // Emit installation event
        window.dispatchEvent(
          new CustomEvent('pluginInstalled', {
            detail: { pluginId: manifest.id, version: manifest.version }
          })
        );

        return success;
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw lastError;
  } catch (error) {
    if (error instanceof PluginServiceError) {
      throw error;
    }
    throw new PluginServiceError(
      'Plugin installation failed',
      'INSTALL_FAILED',
      manifest.id,
      { originalError: error }
    );
  }
}

/**
 * Uninstalls a plugin with complete resource cleanup
 */
@performanceMonitor
export async function uninstallPlugin(pluginId: string): Promise<void> {
  try {
    // Unload plugin and cleanup resources
    await unloadPlugin(pluginId);

    // Remove plugin files from cache
    localStorage.removeItem(`${PLUGIN_CACHE_PREFIX}${pluginId}`);

    // Remove plugin configuration
    localStorage.removeItem(`${PLUGIN_CONFIG_KEY}_${pluginId}`);

    // Emit uninstallation event
    window.dispatchEvent(
      new CustomEvent('pluginUninstalled', {
        detail: { pluginId }
      })
    );
  } catch (error) {
    throw new PluginServiceError(
      'Plugin uninstallation failed',
      'UNINSTALL_FAILED',
      pluginId,
      { originalError: error }
    );
  }
}
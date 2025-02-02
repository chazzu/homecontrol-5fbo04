import { z } from 'zod'; // ^3.0.0
import { IPlugin } from '../interfaces/IPlugin';
import { 
  PluginState, 
  PluginMetadata, 
  PluginConfig, 
  PluginLifecycleHooks 
} from '../types/Plugin.types';

/**
 * Regular expression for semantic version validation
 * Ensures version follows x.y.z format
 */
const PLUGIN_VERSION_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Maximum allowed lengths for plugin metadata fields
 */
const MAX_PLUGIN_NAME_LENGTH = 50;
const MAX_PLUGIN_DESCRIPTION_LENGTH = 500;

/**
 * Timeout for plugin validation operations in milliseconds
 */
const PLUGIN_VALIDATION_TIMEOUT = 2000;

/**
 * Patterns to detect sensitive data in plugin configurations
 */
const SENSITIVE_DATA_PATTERNS = ['password', 'token', 'secret', 'key'];

/**
 * Zod schema for plugin metadata validation
 */
const metadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(MAX_PLUGIN_NAME_LENGTH).regex(/^[a-zA-Z0-9-_]+$/),
  version: z.string().regex(PLUGIN_VERSION_REGEX),
  author: z.string().min(1),
  description: z.string().max(MAX_PLUGIN_DESCRIPTION_LENGTH),
  dependencies: z.record(z.string()),
  permissions: z.array(z.string())
});

/**
 * Performance monitoring decorator for validation functions
 */
function performanceMonitor(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Validation timeout')), PLUGIN_VALIDATION_TIMEOUT)
        )
      ]);
      const duration = performance.now() - start;
      console.debug(`Plugin validation ${propertyKey} completed in ${duration}ms`);
      return result;
    } catch (error) {
      console.error(`Plugin validation ${propertyKey} failed:`, error);
      throw error;
    }
  };
  return descriptor;
}

/**
 * Validates plugin metadata against required schema with enhanced security checks
 * @param metadata Plugin metadata to validate
 * @throws {ValidationError} If metadata is invalid
 */
@performanceMonitor
export async function validatePluginMetadata(metadata: PluginMetadata): Promise<boolean> {
  try {
    // Validate against schema
    metadataSchema.parse(metadata);

    // Additional security checks
    if (metadata.name.includes('<') || metadata.name.includes('>')) {
      throw new Error('Plugin name contains potential XSS content');
    }

    if (metadata.description.includes('<script>')) {
      throw new Error('Plugin description contains potential malicious content');
    }

    // Validate dependencies format
    for (const [dep, version] of Object.entries(metadata.dependencies)) {
      if (!PLUGIN_VERSION_REGEX.test(version)) {
        throw new Error(`Invalid version format for dependency ${dep}`);
      }
    }

    return true;
  } catch (error) {
    throw new Error(`Plugin metadata validation failed: ${error.message}`);
  }
}

/**
 * Validates plugin configuration object with security and performance checks
 * @param config Plugin configuration to validate
 * @throws {ValidationError} If configuration is invalid
 */
@performanceMonitor
export async function validatePluginConfig(config: PluginConfig): Promise<boolean> {
  try {
    // Check for sensitive data patterns
    const configStr = JSON.stringify(config);
    for (const pattern of SENSITIVE_DATA_PATTERNS) {
      if (configStr.toLowerCase().includes(pattern)) {
        throw new Error(`Configuration contains sensitive data pattern: ${pattern}`);
      }
    }

    // Validate configuration size
    if (configStr.length > 1024 * 1024) { // 1MB limit
      throw new Error('Configuration size exceeds limit');
    }

    // Check for circular references
    const seen = new WeakSet();
    JSON.stringify(config, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          throw new Error('Circular reference detected in configuration');
        }
        seen.add(value);
      }
      return value;
    });

    return true;
  } catch (error) {
    throw new Error(`Plugin configuration validation failed: ${error.message}`);
  }
}

/**
 * Validates plugin lifecycle hook implementations
 * @param hooks Plugin lifecycle hooks to validate
 * @throws {ValidationError} If lifecycle hooks are invalid
 */
@performanceMonitor
export async function validatePluginLifecycle(hooks: PluginLifecycleHooks): Promise<boolean> {
  try {
    // Validate required hook implementations
    if (typeof hooks.onInitialize !== 'function') {
      throw new Error('Missing onInitialize hook implementation');
    }
    if (typeof hooks.onCleanup !== 'function') {
      throw new Error('Missing onCleanup hook implementation');
    }
    if (typeof hooks.onStateChange !== 'function') {
      throw new Error('Missing onStateChange hook implementation');
    }
    if (typeof hooks.onError !== 'function') {
      throw new Error('Missing onError hook implementation');
    }

    // Validate hook function signatures
    const initializeResult = hooks.onInitialize();
    const cleanupResult = hooks.onCleanup();
    const stateChangeResult = hooks.onStateChange(PluginState.ACTIVE, PluginState.INACTIVE);
    const errorResult = hooks.onError(new Error('Validation test'));

    if (!(initializeResult instanceof Promise)) {
      throw new Error('onInitialize must return a Promise');
    }
    if (!(cleanupResult instanceof Promise)) {
      throw new Error('onCleanup must return a Promise');
    }
    if (!(stateChangeResult instanceof Promise)) {
      throw new Error('onStateChange must return a Promise');
    }
    if (!(errorResult instanceof Promise)) {
      throw new Error('onError must return a Promise');
    }

    return true;
  } catch (error) {
    throw new Error(`Plugin lifecycle validation failed: ${error.message}`);
  }
}

/**
 * Validates that plugin implements required interface
 * @param plugin Plugin instance to validate
 * @throws {ValidationError} If plugin interface is invalid
 */
@performanceMonitor
export async function validatePluginInterface(plugin: IPlugin): Promise<boolean> {
  try {
    // Verify required properties
    if (!plugin.id || !plugin.name || !plugin.version || !plugin.state) {
      throw new Error('Missing required plugin properties');
    }

    // Validate state value
    if (!Object.values(PluginState).includes(plugin.state)) {
      throw new Error('Invalid plugin state');
    }

    // Verify method implementations
    if (typeof plugin.initialize !== 'function') {
      throw new Error('Missing initialize method implementation');
    }
    if (typeof plugin.cleanup !== 'function') {
      throw new Error('Missing cleanup method implementation');
    }

    // Validate optional router
    if (plugin.getRouter && typeof plugin.getRouter !== 'function') {
      throw new Error('Invalid getRouter implementation');
    }

    return true;
  } catch (error) {
    throw new Error(`Plugin interface validation failed: ${error.message}`);
  }
}

/**
 * Main plugin validation function that orchestrates all validation checks
 * @param plugin Plugin instance to validate
 * @throws {ValidationError} If plugin validation fails
 */
@performanceMonitor
export async function validatePlugin(plugin: IPlugin): Promise<boolean> {
  try {
    // Extract plugin components for validation
    const metadata: PluginMetadata = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      author: plugin.author,
      description: plugin.description,
      dependencies: {},
      permissions: []
    };

    // Perform comprehensive validation
    await validatePluginMetadata(metadata);
    await validatePluginConfig(plugin.config);
    await validatePluginInterface(plugin);

    // Validate lifecycle hooks if implemented
    if (plugin.onStateChange) {
      await validatePluginLifecycle({
        onInitialize: plugin.initialize.bind(plugin),
        onCleanup: plugin.cleanup.bind(plugin),
        onStateChange: plugin.onStateChange.bind(plugin),
        onError: async (error: Error) => {
          console.error('Plugin error:', error);
        }
      });
    }

    return true;
  } catch (error) {
    throw new Error(`Plugin validation failed: ${error.message}`);
  }
}
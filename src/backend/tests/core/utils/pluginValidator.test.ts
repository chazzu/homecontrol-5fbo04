import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from 'jest';
import {
  validatePlugin,
  validatePluginMetadata,
  validatePluginConfig,
  validatePluginLifecycle
} from '../../../src/core/utils/pluginValidator';
import {
  PluginState,
  PluginMetadata,
  PluginConfig,
  PluginLifecycleHooks,
  PluginInterface
} from '../../../src/core/types/Plugin.types';

// Mock performance API if not available in test environment
const mockPerformanceNow = jest.fn(() => Date.now());
if (!global.performance) {
  global.performance = {
    now: mockPerformanceNow
  };
}

describe('Plugin Validator Tests', () => {
  // Test data setup
  let validMetadata: PluginMetadata;
  let validConfig: PluginConfig;
  let validLifecycleHooks: PluginLifecycleHooks;
  let mockPlugin: PluginInterface;

  beforeAll(() => {
    // Setup performance monitoring
    jest.spyOn(global.performance, 'now');
    jest.spyOn(global.console, 'debug');
    jest.spyOn(global.console, 'error');
  });

  beforeEach(() => {
    // Reset test data before each test
    validMetadata = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'test-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Test plugin description',
      dependencies: {},
      permissions: []
    };

    validConfig = {
      enabled: true,
      settings: {
        timeout: 5000,
        retries: 3,
        logLevel: 'info'
      }
    };

    validLifecycleHooks = {
      onInitialize: async () => {},
      onCleanup: async () => {},
      onStateChange: async (newState: PluginState, oldState: PluginState) => {},
      onError: async (error: Error) => {}
    };

    mockPlugin = {
      id: validMetadata.id,
      name: validMetadata.name,
      version: validMetadata.version,
      author: validMetadata.author,
      description: validMetadata.description,
      state: PluginState.INACTIVE,
      config: validConfig,
      initialize: validLifecycleHooks.onInitialize,
      cleanup: validLifecycleHooks.onCleanup,
      onStateChange: validLifecycleHooks.onStateChange
    };
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('validatePluginMetadata', () => {
    it('should pass with valid metadata', async () => {
      await expect(validatePluginMetadata(validMetadata)).resolves.toBe(true);
    });

    it('should fail with missing required fields', async () => {
      const invalidMetadata = { ...validMetadata };
      delete invalidMetadata.id;
      await expect(validatePluginMetadata(invalidMetadata)).rejects.toThrow('Plugin metadata validation failed');
    });

    it('should fail with invalid version format', async () => {
      const invalidMetadata = { ...validMetadata, version: 'invalid' };
      await expect(validatePluginMetadata(invalidMetadata)).rejects.toThrow('Invalid version format');
    });

    it('should fail with invalid id format', async () => {
      const invalidMetadata = { ...validMetadata, id: 'invalid-id' };
      await expect(validatePluginMetadata(invalidMetadata)).rejects.toThrow('Plugin metadata validation failed');
    });

    it('should fail with too long name', async () => {
      const invalidMetadata = { ...validMetadata, name: 'a'.repeat(51) };
      await expect(validatePluginMetadata(invalidMetadata)).rejects.toThrow('Plugin metadata validation failed');
    });

    it('should fail with malicious content', async () => {
      const invalidMetadata = { ...validMetadata, description: '<script>alert("xss")</script>' };
      await expect(validatePluginMetadata(invalidMetadata)).rejects.toThrow('Plugin description contains potential malicious content');
    });
  });

  describe('validatePluginConfig', () => {
    it('should pass with valid configuration', async () => {
      await expect(validatePluginConfig(validConfig)).resolves.toBe(true);
    });

    it('should fail with sensitive data in config', async () => {
      const invalidConfig = {
        ...validConfig,
        settings: {
          ...validConfig.settings,
          password: '123456'
        }
      };
      await expect(validatePluginConfig(invalidConfig)).rejects.toThrow('Configuration contains sensitive data pattern');
    });

    it('should fail with oversized configuration', async () => {
      const largeConfig = {
        ...validConfig,
        settings: {
          ...validConfig.settings,
          largeData: 'x'.repeat(1024 * 1024 + 1)
        }
      };
      await expect(validatePluginConfig(largeConfig)).rejects.toThrow('Configuration size exceeds limit');
    });

    it('should fail with circular references', async () => {
      const circularConfig: any = { ...validConfig };
      circularConfig.circular = circularConfig;
      await expect(validatePluginConfig(circularConfig)).rejects.toThrow('Circular reference detected');
    });
  });

  describe('validatePluginLifecycle', () => {
    it('should pass with valid lifecycle hooks', async () => {
      await expect(validatePluginLifecycle(validLifecycleHooks)).resolves.toBe(true);
    });

    it('should fail with missing required hooks', async () => {
      const invalidHooks = { ...validLifecycleHooks };
      delete invalidHooks.onInitialize;
      await expect(validatePluginLifecycle(invalidHooks)).rejects.toThrow('Missing onInitialize hook implementation');
    });

    it('should fail with non-async hooks', async () => {
      const invalidHooks = {
        ...validLifecycleHooks,
        onInitialize: () => {}
      };
      await expect(validatePluginLifecycle(invalidHooks)).rejects.toThrow('onInitialize must return a Promise');
    });

    it('should fail with invalid hook signatures', async () => {
      const invalidHooks = {
        ...validLifecycleHooks,
        onStateChange: async () => {} // Missing parameters
      };
      await expect(validatePluginLifecycle(invalidHooks)).rejects.toThrow('Plugin lifecycle validation failed');
    });
  });

  describe('validatePlugin', () => {
    it('should pass with fully valid plugin', async () => {
      await expect(validatePlugin(mockPlugin)).resolves.toBe(true);
    });

    it('should complete validation within 500ms', async () => {
      const startTime = performance.now();
      await validatePlugin(mockPlugin);
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should fail with invalid components', async () => {
      const invalidPlugin = { ...mockPlugin, state: 'invalid-state' };
      await expect(validatePlugin(invalidPlugin)).rejects.toThrow('Plugin validation failed');
    });

    it('should handle concurrent validations', async () => {
      const validations = Array(5).fill(mockPlugin).map(validatePlugin);
      await expect(Promise.all(validations)).resolves.toEqual(Array(5).fill(true));
    });

    it('should provide detailed error messages', async () => {
      const invalidPlugin = { ...mockPlugin, id: 'invalid-id' };
      try {
        await validatePlugin(invalidPlugin);
      } catch (error) {
        expect(error.message).toMatch(/Plugin validation failed: Plugin metadata validation failed/);
      }
    });
  });

  describe('Performance Monitoring', () => {
    it('should log validation duration', async () => {
      await validatePlugin(mockPlugin);
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Plugin validation validatePlugin completed in \d+ms/)
      );
    });

    it('should handle validation timeout', async () => {
      jest.useFakeTimers();
      const slowPlugin = {
        ...mockPlugin,
        initialize: async () => new Promise(resolve => setTimeout(resolve, 3000))
      };
      
      const validation = validatePlugin(slowPlugin);
      jest.advanceTimersByTime(2100);
      
      await expect(validation).rejects.toThrow('Validation timeout');
      jest.useRealTimers();
    });
  });
});
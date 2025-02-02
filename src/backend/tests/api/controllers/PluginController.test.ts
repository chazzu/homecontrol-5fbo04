import { jest } from '@jest/globals'; // v29.0.0
import { Request, Response } from 'express'; // v4.18.0
import { MockRequest, MockResponse } from 'jest-mock-express'; // v0.1.1
import { PluginController } from '../../src/api/controllers/PluginController';
import { PluginService } from '../../src/core/services/PluginService';
import { PluginState } from '../../core/interfaces/IPlugin';

// Mock dependencies
jest.mock('../../src/core/services/PluginService');
const mockPluginService = jest.mocked(PluginService);

// Mock performance monitoring
const mockPerformanceMonitor = {
  startTimer: jest.fn(),
  endTimer: jest.fn(),
  recordMetric: jest.fn()
};

// Mock rate limiter
const mockRateLimiter = {
  checkLimit: jest.fn(),
  incrementCounter: jest.fn()
};

// Mock audit logger
const mockAuditLogger = {
  logEvent: jest.fn()
};

describe('PluginController', () => {
  let controller: PluginController;
  let mockRequest: MockRequest;
  let mockResponse: MockResponse;

  beforeAll(() => {
    // Initialize global mocks
    jest.useFakeTimers();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockRateLimiter.checkLimit.mockReturnValue(true);
    mockPerformanceMonitor.startTimer.mockReturnValue(Date.now());

    // Initialize request/response mocks with security headers
    mockRequest = new MockRequest({
      headers: {
        'x-request-id': 'test-request-id',
        'x-forwarded-for': '127.0.0.1'
      }
    });
    mockResponse = new MockResponse();

    // Initialize controller with mocked dependencies
    controller = new PluginController(
      mockPluginService,
      mockPerformanceMonitor,
      mockRateLimiter,
      mockAuditLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('installPlugin', () => {
    const validPlugin = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      state: PluginState.INACTIVE,
      description: 'Test plugin description',
      author: 'Test Author',
      config: {}
    };

    it('should successfully install a valid plugin with security checks', async () => {
      mockPluginService.loadPlugin.mockResolvedValue(validPlugin);
      mockRequest.body = validPlugin;

      await controller.installPlugin(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: validPlugin,
        metadata: expect.any(Object)
      });
      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith({
        action: 'plugin:install',
        pluginId: validPlugin.id,
        success: true
      });
    });

    it('should validate plugin integrity and signature', async () => {
      mockRequest.body = {
        ...validPlugin,
        checksum: 'invalid-checksum'
      };

      await controller.installPlugin(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'PLUGIN_VALIDATION_ERROR'
        })
      });
    });

    it('should enforce rate limiting on installation requests', async () => {
      mockRateLimiter.checkLimit.mockReturnValue(false);
      mockRequest.body = validPlugin;

      await controller.installPlugin(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED'
        })
      });
    });

    it('should measure and verify installation performance', async () => {
      mockRequest.body = validPlugin;
      mockPluginService.loadPlugin.mockResolvedValue(validPlugin);

      await controller.installPlugin(mockRequest, mockResponse);

      expect(mockPerformanceMonitor.startTimer).toHaveBeenCalled();
      expect(mockPerformanceMonitor.endTimer).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'plugin_installation_time',
        expect.any(Number)
      );
    });

    it('should handle validation errors with security context', async () => {
      mockRequest.body = {
        ...validPlugin,
        config: {
          unsafeCode: 'eval("malicious code")'
        }
      };

      await controller.installPlugin(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'SECURITY_VALIDATION_ERROR'
        })
      });
    });
  });

  describe('uninstallPlugin', () => {
    const pluginId = 'test-plugin';

    it('should securely uninstall existing plugin', async () => {
      mockRequest.params = { id: pluginId };
      mockPluginService.unloadPlugin.mockResolvedValue(undefined);

      await controller.uninstallPlugin(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith({
        action: 'plugin:uninstall',
        pluginId,
        success: true
      });
    });

    it('should handle non-existent plugin securely', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockPluginService.unloadPlugin.mockRejectedValue(new Error('Plugin not found'));

      await controller.uninstallPlugin(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'PLUGIN_NOT_FOUND'
        })
      });
    });
  });

  describe('getPlugin', () => {
    const pluginId = 'test-plugin';
    const plugin = {
      id: pluginId,
      name: 'Test Plugin',
      version: '1.0.0',
      state: PluginState.ACTIVE
    };

    it('should securely retrieve existing plugin', async () => {
      mockRequest.params = { id: pluginId };
      mockPluginService.getPlugin.mockResolvedValue(plugin);

      await controller.getPlugin(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: plugin,
        metadata: expect.any(Object)
      });
    });

    it('should handle non-existent plugin securely', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockPluginService.getPlugin.mockResolvedValue(null);

      await controller.getPlugin(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAllPlugins', () => {
    const plugins = [
      { id: 'plugin1', state: PluginState.ACTIVE },
      { id: 'plugin2', state: PluginState.INACTIVE }
    ];

    it('should securely retrieve all plugins with pagination', async () => {
      mockRequest.query = { page: '1', limit: '10' };
      mockPluginService.getAllPlugins.mockResolvedValue(plugins);

      await controller.getAllPlugins(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: plugins,
        metadata: expect.objectContaining({
          total: 2,
          page: 1,
          limit: 10
        })
      });
    });

    it('should handle empty plugin list securely', async () => {
      mockPluginService.getAllPlugins.mockResolvedValue([]);

      await controller.getAllPlugins(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        metadata: expect.any(Object)
      });
    });
  });

  describe('updatePluginState', () => {
    const pluginId = 'test-plugin';
    const newState = PluginState.ACTIVE;

    it('should securely update plugin state', async () => {
      mockRequest.params = { id: pluginId };
      mockRequest.body = { state: newState };

      await controller.updatePluginState(mockRequest, mockResponse);

      expect(mockPluginService.updatePluginState).toHaveBeenCalledWith(
        pluginId,
        newState
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should validate state transition security', async () => {
      mockRequest.params = { id: pluginId };
      mockRequest.body = { state: 'invalid-state' };

      await controller.updatePluginState(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_STATE_TRANSITION'
        })
      });
    });
  });
});
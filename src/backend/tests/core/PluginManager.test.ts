import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PluginManager } from '../../src/core/PluginManager';
import { PluginService } from '../../src/core/services/PluginService';
import { IPlugin } from '../../src/core/interfaces/IPlugin';
import { PluginState } from '../../src/core/types/Plugin.types';

// Mock PluginService
jest.mock('../../src/core/services/PluginService');

// Constants for testing
const TEST_PLUGIN_ID = 'test-plugin-001';
const PERFORMANCE_THRESHOLD = 500; // 500ms load time requirement

describe('PluginManager', () => {
    let pluginManager: PluginManager;
    let mockPluginService: jest.Mocked<PluginService>;

    // Mock plugin implementation
    const mockPlugin: IPlugin = {
        id: TEST_PLUGIN_ID,
        name: 'Test Plugin',
        version: '1.0.0',
        state: PluginState.INACTIVE,
        description: 'Test plugin for unit tests',
        author: 'Test Author',
        config: {},
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined)
    };

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Reset singleton instance
        (PluginManager as any).instance = undefined;
        
        // Initialize mock plugin service
        mockPluginService = {
            loadPlugin: jest.fn().mockResolvedValue(mockPlugin),
            unloadPlugin: jest.fn().mockResolvedValue(undefined),
            getPlugin: jest.fn().mockReturnValue(mockPlugin),
            getAllPlugins: jest.fn().mockReturnValue([mockPlugin])
        } as unknown as jest.Mocked<PluginService>;
    });

    describe('Singleton Pattern', () => {
        test('should create only one instance', () => {
            const instance1 = PluginManager.getInstance(mockPluginService);
            const instance2 = PluginManager.getInstance(mockPluginService);

            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(PluginManager);
        });

        test('should maintain state across getInstance calls', () => {
            const instance1 = PluginManager.getInstance(mockPluginService);
            instance1.loadPlugin(TEST_PLUGIN_ID);

            const instance2 = PluginManager.getInstance(mockPluginService);
            expect(mockPluginService.loadPlugin).toHaveBeenCalledTimes(1);
            expect(instance2).toBe(instance1);
        });
    });

    describe('Plugin Lifecycle Management', () => {
        beforeEach(() => {
            pluginManager = PluginManager.getInstance(mockPluginService);
        });

        test('should load plugin successfully', async () => {
            const startTime = Date.now();
            const plugin = await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            const loadTime = Date.now() - startTime;

            expect(plugin).toBeDefined();
            expect(plugin.id).toBe(TEST_PLUGIN_ID);
            expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLD);
            expect(mockPluginService.loadPlugin).toHaveBeenCalledWith(TEST_PLUGIN_ID);
        });

        test('should unload plugin successfully', async () => {
            await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            await pluginManager.unloadPlugin(TEST_PLUGIN_ID);

            expect(mockPluginService.unloadPlugin).toHaveBeenCalledWith(TEST_PLUGIN_ID);
        });

        test('should handle plugin initialization failure', async () => {
            mockPluginService.loadPlugin.mockRejectedValueOnce(new Error('Initialization failed'));

            await expect(pluginManager.loadPlugin(TEST_PLUGIN_ID))
                .rejects.toThrow('Initialization failed');
        });

        test('should handle plugin cleanup failure', async () => {
            mockPluginService.unloadPlugin.mockRejectedValueOnce(new Error('Cleanup failed'));

            await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            await expect(pluginManager.unloadPlugin(TEST_PLUGIN_ID))
                .rejects.toThrow('Cleanup failed');
        });
    });

    describe('Performance Monitoring', () => {
        beforeEach(() => {
            pluginManager = PluginManager.getInstance(mockPluginService);
        });

        test('should monitor plugin load time', async () => {
            const loadTimePromise = pluginManager.loadPlugin(TEST_PLUGIN_ID);
            const startTime = Date.now();
            
            await loadTimePromise;
            const loadTime = Date.now() - startTime;

            expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLD);
        });

        test('should track plugin health metrics', async () => {
            await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            const health = await pluginManager.monitorPluginHealth(TEST_PLUGIN_ID);

            expect(health).toHaveProperty('healthy');
            expect(health).toHaveProperty('metrics');
            expect(health.metrics).toHaveProperty('loadTime');
            expect(health.metrics).toHaveProperty('memoryUsage');
            expect(health.metrics).toHaveProperty('cpuUsage');
            expect(health.metrics).toHaveProperty('errorCount');
        });
    });

    describe('Security Validation', () => {
        beforeEach(() => {
            pluginManager = PluginManager.getInstance(mockPluginService);
        });

        test('should validate plugin ID format', async () => {
            await expect(pluginManager.loadPlugin('invalid@plugin'))
                .rejects.toThrow('Invalid plugin ID format');
        });

        test('should prevent loading duplicate plugins', async () => {
            await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            await expect(pluginManager.loadPlugin(TEST_PLUGIN_ID))
                .rejects.toThrow('Plugin already loaded');
        });

        test('should validate plugin security requirements', async () => {
            const maliciousPlugin = { ...mockPlugin, id: 'malicious-plugin' };
            mockPluginService.loadPlugin.mockResolvedValueOnce(maliciousPlugin);

            await expect(pluginManager.loadPlugin('malicious-plugin'))
                .rejects.toThrow();
        });
    });

    describe('Event Handling', () => {
        beforeEach(() => {
            pluginManager = PluginManager.getInstance(mockPluginService);
        });

        test('should emit plugin:loaded event', async () => {
            const loadedHandler = jest.fn();
            pluginManager.on('plugin:loaded', loadedHandler);

            await pluginManager.loadPlugin(TEST_PLUGIN_ID);

            expect(loadedHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    pluginId: TEST_PLUGIN_ID,
                    loadTime: expect.any(Number)
                })
            );
        });

        test('should emit plugin:unloaded event', async () => {
            const unloadedHandler = jest.fn();
            pluginManager.on('plugin:unloaded', unloadedHandler);

            await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            await pluginManager.unloadPlugin(TEST_PLUGIN_ID);

            expect(unloadedHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    pluginId: TEST_PLUGIN_ID
                })
            );
        });

        test('should emit plugin:error event on failure', async () => {
            const errorHandler = jest.fn();
            pluginManager.on('plugin:error', errorHandler);

            const error = new Error('Test error');
            mockPluginService.loadPlugin.mockRejectedValueOnce(error);

            await expect(pluginManager.loadPlugin(TEST_PLUGIN_ID)).rejects.toThrow();

            expect(errorHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    pluginId: TEST_PLUGIN_ID,
                    error: expect.objectContaining({
                        message: error.message
                    })
                })
            );
        });
    });

    describe('Resource Management', () => {
        beforeEach(() => {
            pluginManager = PluginManager.getInstance(mockPluginService);
        });

        test('should enforce memory usage limits', async () => {
            const plugin = await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            const health = await pluginManager.monitorPluginHealth(TEST_PLUGIN_ID);

            expect(health.metrics.memoryUsage).toBeDefined();
            expect(health.metrics.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB
        });

        test('should enforce CPU usage limits', async () => {
            const plugin = await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            const health = await pluginManager.monitorPluginHealth(TEST_PLUGIN_ID);

            expect(health.metrics.cpuUsage).toBeDefined();
            expect(health.metrics.cpuUsage).toBeLessThan(80); // 80%
        });

        test('should enforce error count limits', async () => {
            const plugin = await pluginManager.loadPlugin(TEST_PLUGIN_ID);
            const health = await pluginManager.monitorPluginHealth(TEST_PLUGIN_ID);

            expect(health.metrics.errorCount).toBeDefined();
            expect(health.metrics.errorCount).toBeLessThan(10);
        });
    });
});
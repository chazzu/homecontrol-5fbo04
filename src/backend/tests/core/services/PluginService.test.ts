import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { EventEmitter } from 'events';
import { PluginService } from '../../../src/core/services/PluginService';
import { PluginRepository } from '../../../src/database/repositories/PluginRepository';
import { IPlugin } from '../../../src/core/interfaces/IPlugin';
import { PluginState } from '../../../src/core/types/Plugin.types';

// Mock implementation of IPlugin for testing
class MockPlugin implements IPlugin {
    id: string;
    name: string;
    version: string;
    state: PluginState;
    description: string;
    author: string;
    config: Record<string, any>;
    resourceMetrics: {
        memory: number;
        cpu: number;
        lastCheck: Date;
    };

    constructor(id: string, name: string, version: string) {
        this.id = id;
        this.name = name;
        this.version = version;
        this.state = PluginState.INACTIVE;
        this.description = 'Mock plugin for testing';
        this.author = 'Test Author';
        this.config = {};
        this.resourceMetrics = {
            memory: 0,
            cpu: 0,
            lastCheck: new Date()
        };
    }

    async initialize(): Promise<void> {
        return Promise.resolve();
    }

    async cleanup(): Promise<void> {
        return Promise.resolve();
    }

    getResourceUsage(): { memory: number; cpu: number } {
        return {
            memory: this.resourceMetrics.memory,
            cpu: this.resourceMetrics.cpu
        };
    }
}

describe('PluginService', () => {
    let pluginService: PluginService;
    let mockRepository: jest.Mocked<PluginRepository>;
    let mockPlugin: MockPlugin;

    beforeEach(() => {
        // Setup repository mock
        mockRepository = {
            findById: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            savePluginMetrics: jest.fn(),
        } as any;

        // Initialize service
        pluginService = new PluginService(mockRepository);

        // Create mock plugin
        mockPlugin = new MockPlugin('test-plugin', 'Test Plugin', '1.0.0');

        // Reset all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Plugin Lifecycle Management', () => {
        test('loadPlugin should load and initialize plugin within 500ms', async () => {
            // Setup
            const startTime = Date.now();
            mockRepository.findById.mockResolvedValue(mockPlugin);
            mockRepository.update.mockResolvedValue(mockPlugin);

            // Execute
            const loadedPlugin = await pluginService.loadPlugin('test-plugin');

            // Verify
            expect(Date.now() - startTime).toBeLessThan(500); // Performance requirement
            expect(loadedPlugin).toBeDefined();
            expect(loadedPlugin.state).toBe(PluginState.ACTIVE);
            expect(mockRepository.update).toHaveBeenCalledWith('test-plugin', {
                state: PluginState.ACTIVE
            });
        });

        test('loadPlugin should handle initialization timeout', async () => {
            // Setup
            jest.useFakeTimers();
            mockRepository.findById.mockResolvedValue({
                ...mockPlugin,
                initialize: () => new Promise(resolve => setTimeout(resolve, 31000))
            });

            // Execute & Verify
            await expect(pluginService.loadPlugin('test-plugin')).rejects.toThrow('Plugin initialization timeout');
        });

        test('unloadPlugin should properly cleanup resources', async () => {
            // Setup
            const plugin = new MockPlugin('test-plugin', 'Test Plugin', '1.0.0');
            const cleanupSpy = jest.spyOn(plugin, 'cleanup');
            pluginService['_loadedPlugins'].set('test-plugin', plugin);

            // Execute
            await pluginService.unloadPlugin('test-plugin');

            // Verify
            expect(cleanupSpy).toHaveBeenCalled();
            expect(pluginService['_loadedPlugins'].has('test-plugin')).toBeFalsy();
            expect(mockRepository.update).toHaveBeenCalledWith('test-plugin', {
                state: PluginState.INACTIVE
            });
        });
    });

    describe('Plugin State Management', () => {
        test('updatePluginState should validate state transitions', async () => {
            // Setup
            pluginService['_loadedPlugins'].set('test-plugin', mockPlugin);

            // Execute & Verify
            await expect(pluginService.updatePluginState('test-plugin', PluginState.ACTIVE)).resolves.not.toThrow();
            expect(mockRepository.update).toHaveBeenCalledWith('test-plugin', {
                state: PluginState.ACTIVE
            });
        });

        test('updatePluginState should emit state change events', async () => {
            // Setup
            const eventSpy = jest.spyOn(pluginService, 'emit');
            pluginService['_loadedPlugins'].set('test-plugin', mockPlugin);

            // Execute
            await pluginService.updatePluginState('test-plugin', PluginState.ACTIVE);

            // Verify
            expect(eventSpy).toHaveBeenCalledWith('plugin:stateChanged', {
                pluginId: 'test-plugin',
                newState: PluginState.ACTIVE
            });
        });
    });

    describe('Resource Management', () => {
        test('should monitor plugin resource usage', () => {
            // Setup
            jest.useFakeTimers();
            const plugin = new MockPlugin('test-plugin', 'Test Plugin', '1.0.0');
            pluginService['_loadedPlugins'].set('test-plugin', plugin);

            // Mock resource usage
            const resourceSpy = jest.spyOn(plugin, 'getResourceUsage').mockReturnValue({
                memory: 150 * 1024 * 1024, // Exceeds 100MB limit
                cpu: 80
            });

            // Execute
            jest.advanceTimersByTime(60000); // Advance past resource check interval

            // Verify
            expect(resourceSpy).toHaveBeenCalled();
            expect(mockRepository.savePluginMetrics).toHaveBeenCalled();
        });

        test('should emit warning on excessive resource usage', () => {
            // Setup
            jest.useFakeTimers();
            const eventSpy = jest.spyOn(pluginService, 'emit');
            const plugin = new MockPlugin('test-plugin', 'Test Plugin', '1.0.0');
            pluginService['_loadedPlugins'].set('test-plugin', plugin);

            // Mock excessive memory usage
            jest.spyOn(process, 'memoryUsage').mockReturnValue({
                heapUsed: 150 * 1024 * 1024,
                heapTotal: 200 * 1024 * 1024,
                external: 0,
                arrayBuffers: 0,
                rss: 0
            });

            // Execute
            jest.advanceTimersByTime(60000);

            // Verify
            expect(eventSpy).toHaveBeenCalledWith('plugin:resourceWarning', {
                pluginId: 'test-plugin',
                type: 'memory',
                usage: 150 * 1024 * 1024
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle plugin initialization errors', async () => {
            // Setup
            const error = new Error('Initialization failed');
            mockRepository.findById.mockResolvedValue({
                ...mockPlugin,
                initialize: () => Promise.reject(error)
            });

            // Execute & Verify
            await expect(pluginService.loadPlugin('test-plugin')).rejects.toThrow('Plugin initialization failed');
            expect(mockRepository.update).toHaveBeenCalledWith('test-plugin', {
                state: PluginState.ERROR,
                errorLog: expect.any(Object)
            });
        });

        test('should handle cleanup errors', async () => {
            // Setup
            const plugin = new MockPlugin('test-plugin', 'Test Plugin', '1.0.0');
            const error = new Error('Cleanup failed');
            jest.spyOn(plugin, 'cleanup').mockRejectedValue(error);
            pluginService['_loadedPlugins'].set('test-plugin', plugin);

            // Execute & Verify
            await expect(pluginService.unloadPlugin('test-plugin')).rejects.toThrow('Cleanup failed');
            expect(mockRepository.update).toHaveBeenCalledWith('test-plugin', {
                state: PluginState.ERROR,
                errorLog: expect.any(Object)
            });
        });
    });

    describe('Plugin Query Operations', () => {
        test('getPlugin should return loaded plugin', () => {
            // Setup
            pluginService['_loadedPlugins'].set('test-plugin', mockPlugin);

            // Execute & Verify
            expect(pluginService.getPlugin('test-plugin')).toBe(mockPlugin);
        });

        test('getAllPlugins should return all loaded plugins', () => {
            // Setup
            pluginService['_loadedPlugins'].set('test-plugin-1', new MockPlugin('test-plugin-1', 'Test Plugin 1', '1.0.0'));
            pluginService['_loadedPlugins'].set('test-plugin-2', new MockPlugin('test-plugin-2', 'Test Plugin 2', '1.0.0'));

            // Execute & Verify
            const plugins = pluginService.getAllPlugins();
            expect(plugins).toHaveLength(2);
            expect(plugins.map(p => p.id)).toContain('test-plugin-1');
            expect(plugins.map(p => p.id)).toContain('test-plugin-2');
        });
    });
});
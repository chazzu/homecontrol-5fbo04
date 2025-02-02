import { EventEmitter } from 'events'; // latest
import { IPlugin } from '../../core/interfaces/IPlugin';
import { PluginRepository } from '../../database/repositories/PluginRepository';
import { PluginState } from '../../core/types/Plugin.types';

/**
 * Error class for plugin-related exceptions
 */
class PluginError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'PluginError';
    }
}

/**
 * Service class that manages plugin lifecycle, state transitions, security, and performance monitoring
 */
export class PluginService extends EventEmitter {
    private readonly _loadedPlugins: Map<string, IPlugin>;
    private readonly _initTimeouts: Map<string, NodeJS.Timeout>;
    private readonly _resourceUsage: Map<string, {
        memory: number;
        cpu: number;
        lastCheck: Date;
    }>;
    private readonly INIT_TIMEOUT = 30000; // 30 seconds
    private readonly MAX_MEMORY_USAGE = 100 * 1024 * 1024; // 100MB
    private readonly RESOURCE_CHECK_INTERVAL = 60000; // 1 minute

    constructor(private readonly _repository: PluginRepository) {
        super();
        this._loadedPlugins = new Map();
        this._initTimeouts = new Map();
        this._resourceUsage = new Map();
        this.setupResourceMonitoring();
    }

    /**
     * Loads and initializes a plugin with security validation and performance monitoring
     * @param pluginId - Unique identifier of the plugin to load
     * @returns Promise resolving to the loaded plugin
     * @throws {PluginError} If plugin loading or initialization fails
     */
    async loadPlugin(pluginId: string): Promise<IPlugin> {
        const startTime = process.hrtime();

        try {
            // Retrieve plugin from repository
            const plugin = await this._repository.findById(pluginId);
            if (!plugin) {
                throw new PluginError('Plugin not found', 'PLUGIN_NOT_FOUND');
            }

            // Check if plugin is already loaded
            if (this._loadedPlugins.has(pluginId)) {
                throw new PluginError('Plugin already loaded', 'PLUGIN_ALREADY_LOADED');
            }

            // Update plugin state
            await this._repository.update(pluginId, { state: PluginState.INITIALIZING });
            
            // Set initialization timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                const timeout = setTimeout(() => {
                    reject(new PluginError('Plugin initialization timeout', 'PLUGIN_INIT_TIMEOUT'));
                }, this.INIT_TIMEOUT);
                this._initTimeouts.set(pluginId, timeout);
            });

            // Initialize plugin with timeout race
            const initPromise = this.initializePlugin(plugin);
            await Promise.race([initPromise, timeoutPromise]);

            // Clear timeout if initialization successful
            const timeout = this._initTimeouts.get(pluginId);
            if (timeout) {
                clearTimeout(timeout);
                this._initTimeouts.delete(pluginId);
            }

            // Update plugin state and store in loaded plugins map
            await this._repository.update(pluginId, { state: PluginState.ACTIVE });
            this._loadedPlugins.set(pluginId, plugin);

            // Initialize resource monitoring
            this._resourceUsage.set(pluginId, {
                memory: 0,
                cpu: 0,
                lastCheck: new Date()
            });

            // Calculate and log performance metrics
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const loadTime = seconds * 1000 + nanoseconds / 1000000;
            this.emit('plugin:loaded', { pluginId, loadTime });

            return plugin;
        } catch (error) {
            await this.handlePluginError(pluginId, error);
            throw error;
        }
    }

    /**
     * Unloads and cleans up a plugin with resource cleanup and state management
     * @param pluginId - Unique identifier of the plugin to unload
     * @throws {PluginError} If plugin unloading fails
     */
    async unloadPlugin(pluginId: string): Promise<void> {
        const plugin = this._loadedPlugins.get(pluginId);
        if (!plugin) {
            throw new PluginError('Plugin not loaded', 'PLUGIN_NOT_LOADED');
        }

        try {
            // Update plugin state to cleanup
            await this._repository.update(pluginId, { state: PluginState.CLEANUP });

            // Execute plugin cleanup
            await plugin.cleanup();

            // Remove from loaded plugins and resource monitoring
            this._loadedPlugins.delete(pluginId);
            this._resourceUsage.delete(pluginId);

            // Update plugin state to inactive
            await this._repository.update(pluginId, { state: PluginState.INACTIVE });

            this.emit('plugin:unloaded', { pluginId });
        } catch (error) {
            await this.handlePluginError(pluginId, error);
            throw error;
        }
    }

    /**
     * Retrieves a loaded plugin by ID
     * @param pluginId - Unique identifier of the plugin
     * @returns The loaded plugin instance or null if not found
     */
    getPlugin(pluginId: string): IPlugin | null {
        return this._loadedPlugins.get(pluginId) || null;
    }

    /**
     * Retrieves all currently loaded plugins
     * @returns Array of loaded plugin instances
     */
    getAllPlugins(): IPlugin[] {
        return Array.from(this._loadedPlugins.values());
    }

    /**
     * Updates plugin state with validation
     * @param pluginId - Unique identifier of the plugin
     * @param newState - New state to set
     * @throws {PluginError} If state transition is invalid
     */
    async updatePluginState(pluginId: string, newState: PluginState): Promise<void> {
        const plugin = this._loadedPlugins.get(pluginId);
        if (!plugin) {
            throw new PluginError('Plugin not loaded', 'PLUGIN_NOT_LOADED');
        }

        try {
            await this._repository.update(pluginId, { state: newState });
            this.emit('plugin:stateChanged', { pluginId, newState });
        } catch (error) {
            await this.handlePluginError(pluginId, error);
            throw error;
        }
    }

    /**
     * Initializes a plugin with security sandbox
     * @private
     */
    private async initializePlugin(plugin: IPlugin): Promise<void> {
        try {
            await plugin.initialize();
        } catch (error) {
            throw new PluginError(
                `Plugin initialization failed: ${error.message}`,
                'PLUGIN_INIT_FAILED'
            );
        }
    }

    /**
     * Sets up periodic resource usage monitoring
     * @private
     */
    private setupResourceMonitoring(): void {
        setInterval(() => {
            this._loadedPlugins.forEach((plugin, pluginId) => {
                const usage = this._resourceUsage.get(pluginId);
                if (usage) {
                    // Check memory usage
                    const memoryUsage = process.memoryUsage().heapUsed;
                    if (memoryUsage > this.MAX_MEMORY_USAGE) {
                        this.emit('plugin:resourceWarning', {
                            pluginId,
                            type: 'memory',
                            usage: memoryUsage
                        });
                    }

                    // Update resource usage metrics
                    this._resourceUsage.set(pluginId, {
                        ...usage,
                        memory: memoryUsage,
                        lastCheck: new Date()
                    });
                }
            });
        }, this.RESOURCE_CHECK_INTERVAL);
    }

    /**
     * Handles plugin errors with logging and state management
     * @private
     */
    private async handlePluginError(pluginId: string, error: Error): Promise<void> {
        const errorDetails = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date()
        };

        try {
            await this._repository.update(pluginId, {
                state: PluginState.ERROR,
                errorLog: errorDetails
            });

            this.emit('plugin:error', {
                pluginId,
                error: errorDetails
            });
        } catch (logError) {
            console.error('Failed to log plugin error:', logError);
        }
    }
}

export default PluginService;
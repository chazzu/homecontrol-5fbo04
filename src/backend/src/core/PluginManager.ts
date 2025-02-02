import { EventEmitter } from 'events'; // latest
import { Logger } from 'winston'; // v3.8.0
import { IPlugin } from '../core/interfaces/IPlugin';
import { PluginService } from '../core/services/PluginService';
import { PluginState } from '../core/types/Plugin.types';

/**
 * Interface for plugin performance metrics collection
 */
interface PluginMetrics {
    loadTime: number;
    memoryUsage: number;
    cpuUsage: number;
    errorCount: number;
    lastHealthCheck: Date;
}

/**
 * Interface for plugin resource quotas
 */
interface ResourceQuota {
    maxMemory: number;
    maxCpu: number;
    maxErrors: number;
}

/**
 * Enhanced singleton manager class that handles plugin lifecycle, security validation,
 * performance monitoring, and operations in the Smart Home Dashboard system.
 */
export class PluginManager extends EventEmitter {
    private static instance: PluginManager;
    private readonly pluginService: PluginService;
    private readonly activePlugins: Map<string, IPlugin>;
    private readonly logger: Logger;
    private readonly pluginMetrics: Map<string, PluginMetrics>;
    private readonly pluginQuotas: Map<string, ResourceQuota>;

    private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
    private readonly DEFAULT_QUOTA: ResourceQuota = {
        maxMemory: 100 * 1024 * 1024, // 100MB
        maxCpu: 80, // 80% CPU usage
        maxErrors: 10 // Max errors before automatic shutdown
    };

    /**
     * Private constructor for singleton pattern with enhanced initialization
     */
    private constructor(pluginService: PluginService) {
        super();
        this.pluginService = pluginService;
        this.activePlugins = new Map();
        this.pluginMetrics = new Map();
        this.pluginQuotas = new Map();

        // Initialize logger
        this.logger = this.initializeLogger();

        // Setup periodic health monitoring
        this.setupHealthMonitoring();

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Gets or creates singleton instance with validation
     */
    public static getInstance(pluginService: PluginService): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager(pluginService);
        }
        return PluginManager.instance;
    }

    /**
     * Loads and initializes a plugin with security and performance monitoring
     */
    public async loadPlugin(pluginId: string): Promise<IPlugin> {
        const startTime = process.hrtime();

        try {
            // Validate plugin ID
            if (!this.validatePluginId(pluginId)) {
                throw new Error('Invalid plugin ID format');
            }

            // Initialize metrics tracking
            this.pluginMetrics.set(pluginId, {
                loadTime: 0,
                memoryUsage: 0,
                cpuUsage: 0,
                errorCount: 0,
                lastHealthCheck: new Date()
            });

            // Set default resource quota
            this.pluginQuotas.set(pluginId, { ...this.DEFAULT_QUOTA });

            // Load plugin through service
            const plugin = await this.pluginService.loadPlugin(pluginId);

            // Perform security validation
            await this.validatePluginSecurity(plugin);

            // Initialize plugin in sandbox
            await this.initializePluginSandbox(plugin);

            // Store in active plugins map
            this.activePlugins.set(pluginId, plugin);

            // Calculate and store load time
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const loadTime = seconds * 1000 + nanoseconds / 1000000;

            // Update metrics
            const metrics = this.pluginMetrics.get(pluginId);
            if (metrics) {
                metrics.loadTime = loadTime;
            }

            this.logger.info(`Plugin ${pluginId} loaded successfully in ${loadTime}ms`);
            this.emit('plugin:loaded', { pluginId, loadTime });

            return plugin;
        } catch (error) {
            this.handlePluginError(pluginId, error);
            throw error;
        }
    }

    /**
     * Unloads and cleans up a plugin with resource cleanup
     */
    public async unloadPlugin(pluginId: string): Promise<void> {
        try {
            const plugin = this.activePlugins.get(pluginId);
            if (!plugin) {
                throw new Error('Plugin not found');
            }

            // Stop metrics collection
            this.pluginMetrics.delete(pluginId);

            // Release resource quotas
            this.pluginQuotas.delete(pluginId);

            // Cleanup plugin sandbox
            await this.cleanupPluginSandbox(plugin);

            // Unload through service
            await this.pluginService.unloadPlugin(pluginId);

            // Remove from active plugins
            this.activePlugins.delete(pluginId);

            this.logger.info(`Plugin ${pluginId} unloaded successfully`);
            this.emit('plugin:unloaded', { pluginId });
        } catch (error) {
            this.handlePluginError(pluginId, error);
            throw error;
        }
    }

    /**
     * Monitors plugin health and resource usage
     */
    public async monitorPluginHealth(pluginId: string): Promise<{
        healthy: boolean;
        metrics: PluginMetrics;
    }> {
        const plugin = this.activePlugins.get(pluginId);
        const metrics = this.pluginMetrics.get(pluginId);
        const quota = this.pluginQuotas.get(pluginId);

        if (!plugin || !metrics || !quota) {
            throw new Error('Plugin not found or metrics not initialized');
        }

        const healthy = this.validateHealthMetrics(metrics, quota);

        // Update last health check timestamp
        metrics.lastHealthCheck = new Date();

        return {
            healthy,
            metrics: { ...metrics }
        };
    }

    /**
     * Initializes Winston logger with custom configuration
     */
    private initializeLogger(): Logger {
        // Logger configuration would go here
        return {} as Logger; // Placeholder
    }

    /**
     * Sets up periodic health monitoring for all active plugins
     */
    private setupHealthMonitoring(): void {
        setInterval(async () => {
            for (const [pluginId] of this.activePlugins) {
                try {
                    const health = await this.monitorPluginHealth(pluginId);
                    if (!health.healthy) {
                        this.logger.warn(`Unhealthy plugin detected: ${pluginId}`);
                        this.emit('plugin:unhealthy', { pluginId, metrics: health.metrics });
                    }
                } catch (error) {
                    this.handlePluginError(pluginId, error);
                }
            }
        }, this.HEALTH_CHECK_INTERVAL);
    }

    /**
     * Sets up event listeners for plugin lifecycle events
     */
    private setupEventListeners(): void {
        this.on('plugin:error', ({ pluginId, error }) => {
            const metrics = this.pluginMetrics.get(pluginId);
            if (metrics) {
                metrics.errorCount++;
                if (metrics.errorCount >= this.DEFAULT_QUOTA.maxErrors) {
                    this.logger.error(`Plugin ${pluginId} exceeded error quota, initiating shutdown`);
                    this.unloadPlugin(pluginId).catch(e => this.logger.error(e));
                }
            }
        });
    }

    /**
     * Validates plugin ID format
     */
    private validatePluginId(pluginId: string): boolean {
        return /^[a-zA-Z0-9-_]+$/.test(pluginId);
    }

    /**
     * Validates plugin security requirements
     */
    private async validatePluginSecurity(plugin: IPlugin): Promise<void> {
        // Security validation implementation would go here
    }

    /**
     * Initializes plugin in a sandboxed environment
     */
    private async initializePluginSandbox(plugin: IPlugin): Promise<void> {
        // Sandbox initialization implementation would go here
    }

    /**
     * Cleans up plugin sandbox environment
     */
    private async cleanupPluginSandbox(plugin: IPlugin): Promise<void> {
        // Sandbox cleanup implementation would go here
    }

    /**
     * Validates plugin health metrics against quotas
     */
    private validateHealthMetrics(metrics: PluginMetrics, quota: ResourceQuota): boolean {
        return (
            metrics.memoryUsage <= quota.maxMemory &&
            metrics.cpuUsage <= quota.maxCpu &&
            metrics.errorCount < quota.maxErrors
        );
    }

    /**
     * Handles plugin errors with logging and event emission
     */
    private handlePluginError(pluginId: string, error: Error): void {
        this.logger.error(`Plugin ${pluginId} error: ${error.message}`, {
            stack: error.stack,
            pluginId
        });

        this.emit('plugin:error', {
            pluginId,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
}

export default PluginManager;
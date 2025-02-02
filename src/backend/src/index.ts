/**
 * Entry point for Smart Home Dashboard backend application
 * Implements high-level system architecture with Express server and WebSocket integration,
 * including connection pooling, load balancing, and comprehensive monitoring.
 * @version 1.0.0
 */

import 'dotenv/config'; // v16.0.0
import pm2 from 'pm2'; // v5.3.0
import { collectDefaultMetrics, Registry } from 'prom-client'; // v14.0.0
import app from './server';
import { logger } from './config/logger';
import { WebSocketConfig } from './config/websocket';
import { WebSocketManager } from './core/WebSocketManager';
import { ENV, SERVER } from './config/constants';

// Initialize metrics collector
const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

/**
 * Starts the server with comprehensive error handling and monitoring
 */
async function startServer(): Promise<void> {
    try {
        // Initialize WebSocket manager
        const wsManager = WebSocketManager.getInstance();
        await wsManager.connect();

        // Configure process clustering in production
        if (ENV.IS_PRODUCTION) {
            await initializeCluster();
        }

        // Start HTTP server
        const server = app.listen(SERVER.PORT, () => {
            logger.info(`Server started on ${SERVER.HOST}:${SERVER.PORT} in ${ENV.NODE_ENV} mode`);
            logger.info(`WebSocket server connected to ${WebSocketConfig.url}`);
        });

        // Configure server timeouts
        server.timeout = 30000; // 30 seconds
        server.keepAliveTimeout = 65000; // 65 seconds
        server.headersTimeout = 66000; // 66 seconds

        // Initialize health check endpoint
        app.get('/health', (req, res) => {
            const wsState = wsManager.getConnectionState();
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                wsConnection: wsState.state,
                metrics: {
                    memory: process.memoryUsage(),
                    cpu: process.cpuUsage()
                }
            });
        });

        // Initialize metrics endpoint
        app.get('/metrics', async (req, res) => {
            try {
                const metrics = await metricsRegistry.metrics();
                res.set('Content-Type', metricsRegistry.contentType);
                res.end(metrics);
            } catch (error) {
                res.status(500).end();
            }
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

/**
 * Initializes PM2 process clustering for production environment
 */
async function initializeCluster(): Promise<void> {
    return new Promise((resolve, reject) => {
        pm2.connect((err) => {
            if (err) {
                logger.error('Failed to connect to PM2:', err);
                reject(err);
                return;
            }

            pm2.start({
                script: 'dist/index.js',
                name: 'smart-home-dashboard',
                exec_mode: 'cluster',
                instances: 'max',
                max_memory_restart: '500M',
                env: {
                    NODE_ENV: 'production'
                }
            }, (err) => {
                if (err) {
                    logger.error('Failed to start PM2 cluster:', err);
                    reject(err);
                    return;
                }
                logger.info('PM2 cluster initialized successfully');
                resolve();
            });
        });
    });
}

/**
 * Handles graceful server shutdown with connection draining
 */
async function gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);

    try {
        // Stop accepting new connections
        if (app) {
            await new Promise<void>((resolve) => {
                app.listen().close(() => {
                    logger.info('HTTP server closed');
                    resolve();
                });
            });
        }

        // Close WebSocket connections
        const wsManager = WebSocketManager.getInstance();
        await wsManager.disconnect(true);

        // Disconnect PM2 if in production
        if (ENV.IS_PRODUCTION) {
            await new Promise<void>((resolve) => {
                pm2.disconnect(() => resolve());
            });
        }

        // Final cleanup
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

/**
 * Sets up process event handlers for graceful shutdown and error handling
 */
function handleProcessEvents(): void {
    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Unhandled error handlers
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception:', error);
        gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection at:', { promise, reason });
        gracefulShutdown('unhandledRejection');
    });

    // Memory monitoring
    setInterval(() => {
        const memoryUsage = process.memoryUsage();
        if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
            logger.warn('High memory usage detected:', memoryUsage);
        }
    }, 60000); // Check every minute
}

// Initialize application
handleProcessEvents();
startServer().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
});

// Export for testing
export { startServer, gracefulShutdown };
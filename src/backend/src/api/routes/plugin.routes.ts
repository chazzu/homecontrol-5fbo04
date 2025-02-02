import express from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import winston from 'winston'; // ^3.8.0
import { PluginController } from '../controllers/PluginController';
import { authenticate } from '../middleware/auth';
import { validatePluginOperationRequest } from '../middleware/validation';
import createRateLimiter from '../middleware/rateLimiter';
import errorHandler from '../middleware/errorHandler';
import { SECURITY } from '../../config/constants';

// Initialize router
const router = express.Router();

// Create plugin-specific rate limiter
const pluginRateLimiter = createRateLimiter({
    windowMs: SECURITY.RATE_LIMIT_WINDOW,
    max: SECURITY.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many plugin operations, please try again later'
});

// Initialize request logger
const requestLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'plugin-routes' },
    transports: [
        new winston.transports.Console()
    ]
});

/**
 * Initializes plugin routes with comprehensive middleware stack
 * @param pluginController - Instance of PluginController for handling plugin operations
 * @returns Configured Express router
 */
const initializeRoutes = (pluginController: PluginController): express.Router => {
    // Apply CORS middleware with security configuration
    router.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Total-Count', 'X-Rate-Limit'],
        credentials: true,
        maxAge: 600 // 10 minutes
    }));

    // Apply request logging middleware
    router.use((req, res, next) => {
        requestLogger.info('Plugin API request', {
            method: req.method,
            path: req.path,
            ip: req.ip,
            timestamp: new Date().toISOString()
        });
        next();
    });

    // Apply authentication middleware to all routes
    router.use(authenticate);

    // Apply rate limiting middleware
    router.use(pluginRateLimiter);

    // Plugin installation endpoint
    router.post('/plugins',
        validatePluginOperationRequest,
        async (req, res, next) => {
            try {
                const result = await pluginController.installPlugin(req, res);
                res.status(201).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Plugin uninstallation endpoint
    router.delete('/plugins/:id',
        validatePluginOperationRequest,
        async (req, res, next) => {
            try {
                const result = await pluginController.uninstallPlugin(req, res);
                res.status(200).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Get all plugins endpoint with caching
    router.get('/plugins',
        async (req, res, next) => {
            try {
                const result = await pluginController.getAllPlugins(req, res);
                // Set cache control headers for GET requests
                res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
                res.status(200).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Get specific plugin endpoint
    router.get('/plugins/:id',
        validatePluginOperationRequest,
        async (req, res, next) => {
            try {
                const result = await pluginController.getPlugin(req, res);
                res.status(200).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Update plugin state endpoint
    router.put('/plugins/:id/state',
        validatePluginOperationRequest,
        async (req, res, next) => {
            try {
                const result = await pluginController.updatePluginState(req, res);
                res.status(200).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    // Apply error handling middleware
    router.use(errorHandler);

    return router;
};

// Export configured router
export default initializeRoutes;
/**
 * Main router configuration file for Smart Home Dashboard API
 * Implements secure, performant, and monitored API endpoints with comprehensive middleware chain
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import rateLimit from 'express-rate-limit'; // ^6.9.0
import morgan from 'morgan'; // ^1.10.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

// Import route modules
import floorPlanRouter from './floorPlan.routes';
import pluginRouter from './plugin.routes';
import stateRouter from './state.routes';

// Import middleware
import errorHandler from '../middleware/errorHandler';
import { SECURITY } from '../../config/constants';

// Initialize main router
const router = express.Router();

// CORS configuration with strict security settings
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: [
        'X-Total-Count',
        'X-Rate-Limit',
        'X-Correlation-ID',
        'X-Response-Time'
    ],
    credentials: true,
    maxAge: 86400 // 24 hours
};

// Rate limiting configuration
const rateLimitOptions = {
    windowMs: SECURITY.RATE_LIMIT_WINDOW,
    max: SECURITY.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: express.Request, res: express.Response) => {
        res.status(429).json({
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
                retryAfter: Math.ceil(SECURITY.RATE_LIMIT_WINDOW / 1000)
            }
        });
    }
};

// Compression configuration
const compressionOptions = {
    level: 6,
    threshold: 1024,
    filter: (req: express.Request) => {
        return req.headers['accept-encoding']?.includes('gzip') || false;
    }
};

/**
 * Configures and returns the main Express router with comprehensive middleware chain
 * @returns Configured Express router instance
 */
const configureMainRouter = (): express.Router => {
    // Apply security headers
    router.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                connectSrc: ["'self'", "wss://*.home-assistant.io"],
                imgSrc: ["'self'", "data:", "blob:"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"]
            }
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: { policy: "same-origin" },
        crossOriginResourcePolicy: { policy: "same-origin" },
        dnsPrefetchControl: { allow: false },
        frameguard: { action: "deny" },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        xssFilter: true
    }));

    // Apply CORS with security configuration
    router.use(cors(corsOptions));

    // Apply compression for response optimization
    router.use(compression(compressionOptions));

    // Apply rate limiting
    router.use(rateLimit(rateLimitOptions));

    // Add correlation ID to requests
    router.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        req.headers['x-correlation-id'] = uuidv4();
        next();
    });

    // Request logging with Morgan
    router.use(morgan(':method :url :status :response-time ms - :res[content-length]', {
        skip: (req) => req.path === '/health'
    }));

    // Health check endpoint
    router.get('/health', healthCheck);

    // Mount API routes with versioning
    router.use('/api/v1/floor-plans', floorPlanRouter);
    router.use('/api/v1/plugins', pluginRouter);
    router.use('/api/v1/states', stateRouter);

    // Apply global error handling
    router.use(errorHandler);

    return router;
};

/**
 * Health check endpoint handler for monitoring system status
 */
const healthCheck = (req: express.Request, res: express.Response): void => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
};

// Export configured router
export default configureMainRouter();
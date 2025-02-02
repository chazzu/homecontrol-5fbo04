/**
 * Main Express server configuration and initialization file
 * Implements a production-ready HTTP/WebSocket server with comprehensive security,
 * monitoring, and performance optimizations.
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^6.0.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import cors from 'cors'; // ^2.8.5
import expressPrometheus from 'express-prometheus-middleware'; // ^1.2.0
import { WebSocket } from 'ws'; // ^8.13.0
import { SERVER } from './config/constants';
import { logger } from './config/logger';
import router from './api/routes';
import errorHandler from './api/middleware/errorHandler';

// Initialize Express application
const app = express();

/**
 * Configures comprehensive Express middleware stack with security,
 * monitoring, and performance optimizations
 */
function configureMiddleware(app: express.Application): void {
  // Security headers with strict CSP
  app.use(helmet({
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

  // CORS configuration
  app.use(cors({
    origin: SERVER.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit', 'X-Response-Time'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Compression for response optimization
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req) => {
      return req.headers['accept-encoding']?.includes('gzip') || false;
    }
  }));

  // Request logging with correlation IDs
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    },
    skip: (req) => req.path === '/health'
  }));

  // Rate limiting protection
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' }
  }));

  // Performance metrics collection
  app.use(expressPrometheus({
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 1.5, 2, 5],
    requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
    responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400]
  }));

  // Body parsers with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // API routes with version prefix
  app.use('/api/v1', router);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Global error handler
  app.use(errorHandler);
}

/**
 * Initializes and starts the HTTP/WebSocket server with graceful shutdown support
 */
async function startServer(): Promise<void> {
  try {
    // Configure middleware
    configureMiddleware(app);

    // Create HTTP server
    const server = app.listen(SERVER.PORT, () => {
      logger.info(`Server started on ${SERVER.HOST}:${SERVER.PORT} in ${SERVER.NODE_ENV} mode`);
    });

    // Initialize WebSocket server
    const wss = new WebSocket.Server({ server });
    wss.on('connection', (ws) => {
      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
      await gracefulShutdown(server);
    });

    process.on('SIGINT', async () => {
      await gracefulShutdown(server);
    });

  } catch (error) {
    logger.error('Server startup error:', error);
    process.exit(1);
  }
}

/**
 * Handles graceful server shutdown with connection draining
 */
async function gracefulShutdown(server: any): Promise<void> {
  logger.info('Initiating graceful shutdown...');

  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('Server closed');
    });

    // Close all WebSocket connections
    server.clients?.forEach((client: WebSocket) => {
      client.close();
    });

    // Wait for existing requests to complete (max 30 seconds)
    await new Promise(resolve => setTimeout(resolve, 30000));

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default app;
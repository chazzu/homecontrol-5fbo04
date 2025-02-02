/**
 * @file State management routes for Smart Home Dashboard
 * @version 1.0.0
 * 
 * Implements secure, performant, and validated routes for entity state operations
 * with comprehensive error handling, caching, and monitoring.
 */

import express from 'express'; // ^4.18.2
import compression from 'compression'; // ^1.7.4
import cors from 'cors'; // ^2.8.5
import rateLimit from 'express-rate-limit'; // ^6.7.0
import winston from 'winston'; // ^3.8.2
import { authenticate } from '../middleware/auth';
import { validateStateUpdateRequest } from '../middleware/validation';
import { StateController } from '../controllers/StateController';
import { errorHandler } from '../middleware/errorHandler';
import { SECURITY } from '../../config/constants';

// Initialize router
const router = express.Router();

// Configure rate limiting
const rateLimiter = rateLimit({
  windowMs: SECURITY.RATE_LIMIT_WINDOW,
  max: SECURITY.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Configure CORS for state endpoints
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-State-Cache', 'X-State-Timestamp'],
  maxAge: 86400 // 24 hours
};

// Configure compression
const compressionOptions = {
  level: 6,
  threshold: 1024,
  filter: (req: express.Request) => {
    return req.headers['accept-encoding']?.includes('gzip') || false;
  }
};

// Initialize state controller
const stateController = new StateController();

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'state-routes' }
});

/**
 * Apply global middleware
 */
router.use(compression(compressionOptions));
router.use(cors(corsOptions));
router.use(rateLimiter);
router.use(authenticate);

/**
 * GET /api/states
 * Retrieve all entity states with pagination and filtering
 */
router.get('/', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    logger.info('Retrieving all states', {
      query: req.query,
      user: req.user?.id
    });

    await stateController.getAllStates(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/states/:entityId
 * Retrieve state of specific entity with caching
 */
router.get('/:entityId', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    logger.info('Retrieving entity state', {
      entityId: req.params.entityId,
      user: req.user?.id
    });

    await stateController.getState(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/states/:entityId
 * Update state of specific entity with validation
 */
router.post('/:entityId',
  validateStateUpdateRequest,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      logger.info('Updating entity state', {
        entityId: req.params.entityId,
        user: req.user?.id,
        payload: req.body
      });

      await stateController.setState(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handling middleware
router.use(errorHandler);

// Export configured router
export default router;
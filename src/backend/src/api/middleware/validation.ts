import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { z } from 'zod'; // v3.0.0
import { LRUCache } from 'lru-cache'; // v7.0.0
import { validateFloorPlanCreate, validateFloorPlanUpdate } from '../validators/floorPlan.validator';
import { FloorPlanValidationError } from '../../core/types/FloorPlan.types';

// Constants for validation configuration
const VALIDATION_CONFIG = {
  RATE_LIMIT: {
    WINDOW_MS: 60000, // 1 minute
    MAX_REQUESTS: 1000,
  },
  CACHE: {
    MAX_SIZE: 1000,
    TTL: 300000, // 5 minutes
  },
  TIMEOUT: 5000, // 5 seconds
  MAX_PAYLOAD_SIZE: 5 * 1024 * 1024, // 5MB
} as const;

// Validation cache using LRU
const validationCache = new LRUCache<string, boolean>({
  max: VALIDATION_CONFIG.CACHE.MAX_SIZE,
  ttl: VALIDATION_CONFIG.CACHE.TTL,
});

// Rate limiting state
const rateLimitState = new Map<string, {
  count: number;
  windowStart: number;
}>();

/**
 * Interface for validation options
 */
interface ValidationOptions {
  schema?: z.ZodSchema;
  skipCache?: boolean;
  maxPayloadSize?: number;
  customValidation?: (data: unknown) => Promise<boolean>;
}

/**
 * Checks if the request is within rate limits
 * @param clientId - Unique identifier for rate limiting
 */
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const state = rateLimitState.get(clientId) || { count: 0, windowStart: now };

  // Reset window if expired
  if (now - state.windowStart >= VALIDATION_CONFIG.RATE_LIMIT.WINDOW_MS) {
    state.count = 0;
    state.windowStart = now;
  }

  // Check if limit exceeded
  if (state.count >= VALIDATION_CONFIG.RATE_LIMIT.MAX_REQUESTS) {
    return false;
  }

  // Update state
  state.count++;
  rateLimitState.set(clientId, state);
  return true;
}

/**
 * Generates cache key for validation results
 */
function generateCacheKey(req: Request): string {
  return `${req.method}-${req.path}-${JSON.stringify(req.body)}`;
}

/**
 * Enhanced request validation middleware with caching and rate limiting
 */
export async function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
  options: ValidationOptions
): Promise<void> {
  const startTime = Date.now();
  const clientId = req.ip || 'unknown';

  try {
    // Check rate limit
    if (!checkRateLimit(clientId)) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many validation requests',
          details: {
            windowMs: VALIDATION_CONFIG.RATE_LIMIT.WINDOW_MS,
            maxRequests: VALIDATION_CONFIG.RATE_LIMIT.MAX_REQUESTS,
          },
        },
      });
      return;
    }

    // Check payload size
    const payloadSize = Buffer.byteLength(JSON.stringify(req.body));
    if (payloadSize > (options.maxPayloadSize || VALIDATION_CONFIG.MAX_PAYLOAD_SIZE)) {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload size exceeds limit',
          details: {
            size: payloadSize,
            limit: options.maxPayloadSize || VALIDATION_CONFIG.MAX_PAYLOAD_SIZE,
          },
        },
      });
      return;
    }

    // Check cache if enabled
    if (!options.skipCache) {
      const cacheKey = generateCacheKey(req);
      const cachedResult = validationCache.get(cacheKey);
      if (cachedResult) {
        next();
        return;
      }
    }

    // Schema validation
    if (options.schema) {
      const validationResult = options.schema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: {
            code: 'SCHEMA_VALIDATION_ERROR',
            message: 'Request validation failed',
            details: validationResult.error.errors,
          },
        });
        return;
      }
    }

    // Custom validation
    if (options.customValidation) {
      const isValid = await Promise.race([
        options.customValidation(req.body),
        new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error('Validation timeout')), VALIDATION_CONFIG.TIMEOUT);
        }),
      ]);

      if (!isValid) {
        res.status(400).json({
          error: {
            code: 'CUSTOM_VALIDATION_ERROR',
            message: 'Custom validation failed',
          },
        });
        return;
      }
    }

    // Cache successful validation
    if (!options.skipCache) {
      const cacheKey = generateCacheKey(req);
      validationCache.set(cacheKey, true);
    }

    // Add validation metadata to request
    req.validationMeta = {
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    next();
  } catch (error) {
    if (error instanceof FloorPlanValidationError) {
      res.status(400).json({
        error: {
          code: error.code,
          message: error.message,
          field: error.field,
          details: error.details,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Enhanced middleware for floor plan request validation
 */
export async function validateFloorPlanRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isCreate = req.method === 'POST';
    const validator = isCreate ? validateFloorPlanCreate : validateFloorPlanUpdate;

    await validateRequest(req, res, next, {
      customValidation: async (data) => {
        try {
          await validator(data);
          return true;
        } catch (error) {
          return false;
        }
      },
      maxPayloadSize: VALIDATION_CONFIG.MAX_PAYLOAD_SIZE,
      skipCache: false, // Enable caching for floor plan validation
    });
  } catch (error) {
    next(error);
  }
}
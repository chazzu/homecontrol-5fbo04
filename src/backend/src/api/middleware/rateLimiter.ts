import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { SECURITY } from '../../config/constants';

/**
 * Interface for rate limiter configuration options
 */
interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  statusCode?: number;
  headers?: boolean;
}

/**
 * Default error message for rate limit exceeded
 */
const DEFAULT_ERROR_MESSAGE = 'Too many requests from this IP, please try again later';

/**
 * Default HTTP status code for rate limit exceeded
 */
const DEFAULT_STATUS_CODE = 429;

/**
 * Creates a configured rate limiter middleware instance
 * @param options - Optional custom configuration options for the rate limiter
 * @returns Express middleware function that implements rate limiting
 */
const createRateLimiter = (options?: RateLimiterOptions) => {
  // Configure rate limiter with defaults from SECURITY constants and any provided options
  const limiterConfig = {
    windowMs: SECURITY.RATE_LIMIT_WINDOW, // Default window from security constants
    max: SECURITY.RATE_LIMIT_MAX_REQUESTS, // Default max requests from security constants
    message: DEFAULT_ERROR_MESSAGE,
    statusCode: DEFAULT_STATUS_CODE,
    headers: true, // Enable rate limit headers by default
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response, _next: NextFunction) => {
      res.status(DEFAULT_STATUS_CODE).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: DEFAULT_ERROR_MESSAGE,
          details: {
            retryAfter: Math.ceil(SECURITY.RATE_LIMIT_WINDOW / 1000), // Convert to seconds
            windowMs: SECURITY.RATE_LIMIT_WINDOW,
            maxRequests: SECURITY.RATE_LIMIT_MAX_REQUESTS
          }
        }
      });
    },
    ...options // Override defaults with any provided options
  };

  // Create and return the configured rate limiter middleware
  return rateLimit(limiterConfig);
};

export default createRateLimiter;
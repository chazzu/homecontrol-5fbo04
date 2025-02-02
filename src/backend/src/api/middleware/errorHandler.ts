import { Request, Response, NextFunction } from 'express';
import { error as logError, warn as logWarn } from '../../config/logger';
import { v4 as uuidv4 } from 'uuid'; // @version ^9.0.0

// Error type constants
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTH_ERROR',
  AUTHORIZATION_ERROR: 'AUTHZ_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  PLUGIN_ERROR: 'PLUGIN_ERROR',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR'
} as const;

// HTTP status codes mapping
export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Custom error class with enhanced tracking capabilities
 */
export class CustomError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: any;
  public readonly correlationId: string;
  public readonly context: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string = ERROR_CODES.INTERNAL_ERROR,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: any,
    context: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'CustomError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.context = context;
    this.correlationId = uuidv4();
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Sanitizes error information to remove sensitive data
 */
const sanitizeError = (error: any): Record<string, any> => {
  const sanitized: Record<string, any> = {
    message: error.message || 'An unexpected error occurred',
    code: error.code || ERROR_CODES.INTERNAL_ERROR,
    correlationId: error.correlationId || uuidv4()
  };

  if (process.env.NODE_ENV !== 'production') {
    sanitized.stack = error.stack;
    sanitized.details = error.details;
  }

  return sanitized;
};

/**
 * Maps error types to appropriate HTTP status codes
 */
const getStatusCode = (error: any): number => {
  if (error instanceof CustomError) {
    return error.statusCode;
  }

  switch (error.code) {
    case ERROR_CODES.VALIDATION_ERROR:
      return HTTP_STATUS.BAD_REQUEST;
    case ERROR_CODES.AUTHENTICATION_ERROR:
      return HTTP_STATUS.UNAUTHORIZED;
    case ERROR_CODES.AUTHORIZATION_ERROR:
      return HTTP_STATUS.FORBIDDEN;
    case ERROR_CODES.NOT_FOUND:
      return HTTP_STATUS.NOT_FOUND;
    case ERROR_CODES.RATE_LIMIT_ERROR:
      return HTTP_STATUS.TOO_MANY_REQUESTS;
    default:
      return HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
};

/**
 * Central error handling middleware for Express application
 * Provides consistent error responses and logging
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID if not present
  const correlationId = (error as CustomError).correlationId || uuidv4();

  // Determine error severity and log accordingly
  const statusCode = getStatusCode(error);
  const logMethod = statusCode >= 500 ? logError : logWarn;

  // Log error with context
  logMethod('Request error:', {
    error: {
      message: error.message,
      stack: error.stack,
      code: (error as CustomError).code,
      details: (error as CustomError).details
    },
    request: {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      headers: {
        'user-agent': req.get('user-agent'),
        'x-forwarded-for': req.get('x-forwarded-for')
      }
    },
    correlationId
  });

  // Prepare error response
  const sanitizedError = sanitizeError(error);

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Correlation-ID', correlationId);

  // Send error response
  res.status(statusCode).json({
    error: sanitizedError,
    timestamp: new Date().toISOString(),
    path: req.path
  });

  // Clear sensitive error information from memory
  if (error instanceof CustomError) {
    error.context = {};
    error.details = undefined;
  }
};

export default errorHandler;
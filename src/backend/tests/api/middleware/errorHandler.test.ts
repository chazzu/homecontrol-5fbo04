import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import express from 'express';
import supertest from 'supertest';
import { errorHandler, CustomError, ERROR_CODES, HTTP_STATUS } from '../../../src/api/middleware/errorHandler';
import { error as logError, warn as logWarn } from '../../../src/config/logger';

// Mock logger functions
jest.mock('../../../src/config/logger', () => ({
  error: jest.fn(),
  warn: jest.fn()
}));

describe('errorHandler middleware', () => {
  let mockApp: express.Application;
  let mockLogger: jest.SpyInstance;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Create test Express app
    mockApp = express();
    mockApp.use((req: Request, res: Response, next: NextFunction) => {
      next(new CustomError('Test error'));
    });
    mockApp.use(errorHandler);

    // Reset logger mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('should handle CustomError with correct status code and format', async () => {
    const error = new CustomError(
      'Validation failed',
      ERROR_CODES.VALIDATION_ERROR,
      HTTP_STATUS.BAD_REQUEST,
      { field: 'username' }
    );

    const response = await supertest(mockApp)
      .get('/')
      .expect(HTTP_STATUS.BAD_REQUEST);

    expect(response.body).toMatchObject({
      error: {
        message: error.message,
        code: ERROR_CODES.VALIDATION_ERROR,
        correlationId: expect.any(String)
      },
      timestamp: expect.any(String),
      path: '/'
    });

    expect(logWarn).toHaveBeenCalledWith(
      'Request error:',
      expect.objectContaining({
        error: expect.objectContaining({
          message: error.message,
          code: ERROR_CODES.VALIDATION_ERROR
        }),
        correlationId: expect.any(String)
      })
    );
  });

  it('should sanitize error details in production environment', async () => {
    process.env.NODE_ENV = 'production';

    const error = new CustomError(
      'Internal error',
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { sensitive: 'data' }
    );

    const response = await supertest(mockApp)
      .get('/')
      .expect(HTTP_STATUS.INTERNAL_SERVER_ERROR);

    expect(response.body.error).not.toHaveProperty('stack');
    expect(response.body.error).not.toHaveProperty('details');
    expect(logError).toHaveBeenCalled();
  });

  it('should include stack traces in development environment', async () => {
    process.env.NODE_ENV = 'development';

    const error = new CustomError(
      'Debug error',
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { debug: 'info' }
    );

    const response = await supertest(mockApp)
      .get('/')
      .expect(HTTP_STATUS.INTERNAL_SERVER_ERROR);

    expect(response.body.error).toHaveProperty('stack');
    expect(response.body.error).toHaveProperty('details');
  });

  it('should set security headers in response', async () => {
    await supertest(mockApp)
      .get('/')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('X-Correlation-ID', expect.any(String));
  });

  it('should log with error level for 5xx errors', async () => {
    const error = new CustomError(
      'Server error',
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );

    await supertest(mockApp).get('/');
    expect(logError).toHaveBeenCalled();
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('should log with warn level for 4xx errors', async () => {
    const error = new CustomError(
      'Client error',
      ERROR_CODES.VALIDATION_ERROR,
      HTTP_STATUS.BAD_REQUEST
    );

    mockApp = express();
    mockApp.use((req, res, next) => next(error));
    mockApp.use(errorHandler);

    await supertest(mockApp).get('/');
    expect(logWarn).toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it('should handle non-CustomError errors', async () => {
    const standardError = new Error('Standard error');
    
    mockApp = express();
    mockApp.use((req, res, next) => next(standardError));
    mockApp.use(errorHandler);

    const response = await supertest(mockApp)
      .get('/')
      .expect(HTTP_STATUS.INTERNAL_SERVER_ERROR);

    expect(response.body.error).toMatchObject({
      message: standardError.message,
      code: ERROR_CODES.INTERNAL_ERROR,
      correlationId: expect.any(String)
    });
  });

  it('should include request context in error logs', async () => {
    const testHeaders = {
      'user-agent': 'test-agent',
      'x-forwarded-for': '127.0.0.1'
    };

    await supertest(mockApp)
      .get('/test?param=value')
      .set(testHeaders);

    expect(logError).toHaveBeenCalledWith(
      'Request error:',
      expect.objectContaining({
        request: expect.objectContaining({
          method: 'GET',
          url: '/test',
          query: { param: 'value' },
          headers: expect.objectContaining(testHeaders)
        })
      })
    );
  });

  it('should clear sensitive information after error handling', async () => {
    const error = new CustomError(
      'Sensitive error',
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { sensitive: 'data' },
      { context: 'sensitive' }
    );

    mockApp = express();
    mockApp.use((req, res, next) => next(error));
    mockApp.use(errorHandler);

    await supertest(mockApp).get('/');

    expect(error.context).toEqual({});
    expect(error.details).toBeUndefined();
  });

  it('should maintain consistent error response structure', async () => {
    const testCases = [
      { 
        error: new CustomError('Auth error', ERROR_CODES.AUTHENTICATION_ERROR, HTTP_STATUS.UNAUTHORIZED),
        expectedStatus: HTTP_STATUS.UNAUTHORIZED 
      },
      { 
        error: new CustomError('Permission error', ERROR_CODES.AUTHORIZATION_ERROR, HTTP_STATUS.FORBIDDEN),
        expectedStatus: HTTP_STATUS.FORBIDDEN 
      },
      { 
        error: new CustomError('Not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND),
        expectedStatus: HTTP_STATUS.NOT_FOUND 
      }
    ];

    for (const testCase of testCases) {
      mockApp = express();
      mockApp.use((req, res, next) => next(testCase.error));
      mockApp.use(errorHandler);

      const response = await supertest(mockApp)
        .get('/')
        .expect(testCase.expectedStatus);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: testCase.error.message,
          code: testCase.error.code,
          correlationId: expect.any(String)
        }),
        timestamp: expect.any(String),
        path: '/'
      });
    }
  });
});
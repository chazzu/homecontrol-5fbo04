import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import express, { Express, Request, Response } from 'express';
import request from 'supertest';
import createRateLimiter from '../../src/api/middleware/rateLimiter';
import { SECURITY } from '../../src/config/constants';

describe('rateLimiter middleware', () => {
  let app: Express;
  let request: request.SuperTest<request.Test>;
  let defaultRateLimiter: express.RequestHandler;

  beforeEach(() => {
    // Reset Jest timers
    jest.useFakeTimers();

    // Create Express app instance
    app = express();

    // Create default rate limiter middleware
    defaultRateLimiter = createRateLimiter();

    // Configure test endpoint
    app.use('/test', defaultRateLimiter);
    app.get('/test', (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    // Initialize supertest instance
    request = request(app);
  });

  afterEach(() => {
    // Clean up
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should allow requests within rate limit', async () => {
    // Make multiple requests within the limit
    for (let i = 0; i < SECURITY.RATE_LIMIT_MAX_REQUESTS - 1; i++) {
      const response = await request.get('/test');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      
      // Verify rate limit headers
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(parseInt(response.headers['ratelimit-remaining'])).toBe(
        SECURITY.RATE_LIMIT_MAX_REQUESTS - i - 1
      );
    }
  });

  it('should block requests exceeding rate limit', async () => {
    // Exhaust the rate limit
    for (let i = 0; i < SECURITY.RATE_LIMIT_MAX_REQUESTS; i++) {
      await request.get('/test');
    }

    // Attempt request after limit exceeded
    const response = await request.get('/test');
    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later',
        details: {
          retryAfter: Math.ceil(SECURITY.RATE_LIMIT_WINDOW / 1000),
          windowMs: SECURITY.RATE_LIMIT_WINDOW,
          maxRequests: SECURITY.RATE_LIMIT_MAX_REQUESTS
        }
      }
    });

    // Verify retry-after header
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('should reset counter after window expiry', async () => {
    // Exhaust the rate limit
    for (let i = 0; i < SECURITY.RATE_LIMIT_MAX_REQUESTS; i++) {
      await request.get('/test');
    }

    // Verify request is blocked
    let response = await request.get('/test');
    expect(response.status).toBe(429);

    // Advance time past the window
    jest.advanceTimersByTime(SECURITY.RATE_LIMIT_WINDOW);

    // Verify new requests are allowed
    response = await request.get('/test');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('should handle custom configuration', async () => {
    const customWindow = 5000; // 5 seconds
    const customMax = 3; // 3 requests
    const customMessage = 'Custom rate limit exceeded';

    // Create new app with custom rate limiter
    const customApp = express();
    const customLimiter = createRateLimiter({
      windowMs: customWindow,
      max: customMax,
      message: customMessage
    });

    customApp.use('/test', customLimiter);
    customApp.get('/test', (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    const customRequest = request(customApp);

    // Make requests up to limit
    for (let i = 0; i < customMax; i++) {
      const response = await customRequest.get('/test');
      expect(response.status).toBe(200);
    }

    // Verify limit is enforced
    const response = await customRequest.get('/test');
    expect(response.status).toBe(429);
    expect(response.body.error.message).toBe(customMessage);
  });

  it('should maintain separate counters for different endpoints', async () => {
    // Configure second endpoint
    app.use('/other', defaultRateLimiter);
    app.get('/other', (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    // Exhaust limit on first endpoint
    for (let i = 0; i < SECURITY.RATE_LIMIT_MAX_REQUESTS; i++) {
      await request.get('/test');
    }

    // Verify first endpoint is blocked
    const testResponse = await request.get('/test');
    expect(testResponse.status).toBe(429);

    // Verify second endpoint still allows requests
    const otherResponse = await request.get('/other');
    expect(otherResponse.status).toBe(200);
  });

  it('should handle concurrent requests correctly', async () => {
    // Send multiple concurrent requests
    const requests = Array(5).fill(null).map(() => request.get('/test'));
    const responses = await Promise.all(requests);

    // Verify all requests succeeded
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });
});
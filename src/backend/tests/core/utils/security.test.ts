import { describe, test, expect } from '@jest/globals'; // v29.0.0
import { 
  getSecurityHeaders, 
  getRateLimitConfig, 
  sanitizeInput, 
  validateRequestData 
} from '../../src/core/utils/security';
import { SECURITY } from '../../src/config/constants';

describe('getSecurityHeaders', () => {
  test('should return all required security headers', () => {
    const headers = getSecurityHeaders();
    
    expect(headers).toHaveProperty('Content-Security-Policy');
    expect(headers).toHaveProperty('Strict-Transport-Security');
    expect(headers).toHaveProperty('X-Content-Type-Options');
    expect(headers).toHaveProperty('X-Frame-Options');
    expect(headers).toHaveProperty('X-XSS-Protection');
    expect(headers).toHaveProperty('Referrer-Policy');
  });

  test('should have correct CSP configuration', () => {
    const headers = getSecurityHeaders();
    expect(headers['Content-Security-Policy']).toBe(
      "default-src 'self'; connect-src 'self' wss://*.home-assistant.io"
    );
  });

  test('should have correct HSTS configuration', () => {
    const headers = getSecurityHeaders();
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  test('should have correct XSS protection configuration', () => {
    const headers = getSecurityHeaders();
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
  });

  test('should have correct frame options', () => {
    const headers = getSecurityHeaders();
    expect(headers['X-Frame-Options']).toBe('DENY');
  });
});

describe('getRateLimitConfig', () => {
  test('should use correct window time from constants', () => {
    const config = getRateLimitConfig();
    expect(config.windowMs).toBe(SECURITY.RATE_LIMIT_WINDOW);
  });

  test('should use correct max requests from constants', () => {
    const config = getRateLimitConfig();
    expect(config.max).toBe(SECURITY.RATE_LIMIT_MAX_REQUESTS);
  });

  test('should have standard headers enabled', () => {
    const config = getRateLimitConfig();
    expect(config.standardHeaders).toBe(true);
  });

  test('should handle rate limit exceeded correctly', () => {
    const config = getRateLimitConfig();
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    config.handler({}, mockRes);
    
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(SECURITY.RATE_LIMIT_WINDOW / 1000)
    });
  });

  test('should skip rate limiting for health endpoints', () => {
    const config = getRateLimitConfig();
    expect(config.skip({ path: '/health' })).toBe(true);
    expect(config.skip({ path: '/ping' })).toBe(true);
    expect(config.skip({ path: '/api/data' })).toBe(false);
  });
});

describe('sanitizeInput', () => {
  const testXSSStrings = [
    "<script>alert('xss')</script>",
    "javascript:alert(1)",
    "<img src=x onerror=alert(1)>"
  ];

  test('should sanitize XSS attack strings', () => {
    testXSSStrings.forEach(xssString => {
      const sanitized = sanitizeInput(xssString);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('onerror=');
    });
  });

  test('should handle nested objects', () => {
    const testNestedData = {
      user: {
        name: "<script>alert(1)</script>",
        settings: {
          theme: "dark"
        }
      }
    };

    const sanitized = sanitizeInput(testNestedData);
    expect(sanitized.user.name).not.toContain('<script>');
    expect(sanitized.user.settings.theme).toBe('dark');
  });

  test('should handle arrays', () => {
    const testArray = ['safe text', "<script>alert(1)</script>", { key: "<img onerror=alert(1)>" }];
    const sanitized = sanitizeInput(testArray);
    
    expect(sanitized[0]).toBe('safe text');
    expect(sanitized[1]).not.toContain('<script>');
    expect(sanitized[2].key).not.toContain('onerror=');
  });

  test('should preserve safe input', () => {
    const safeInput = {
      text: "Hello, World!",
      number: 42,
      boolean: true,
      null: null
    };
    
    const sanitized = sanitizeInput(safeInput);
    expect(sanitized).toEqual(safeInput);
  });
});

describe('validateRequestData', () => {
  const testValidData = {
    username: 'testUser',
    password: 'Test123!',
    email: 'test@example.com'
  };

  const testInvalidData = {
    username: '<script>alert(1)</script>',
    password: '',
    email: 'invalid'
  };

  const validationRules = {
    username: {
      required: true,
      type: 'string',
      minLength: 3,
      maxLength: 50
    },
    password: {
      required: true,
      type: 'string',
      minLength: 8,
      pattern: '^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*#?&])[A-Za-z\\d@$!%*#?&]{8,}$'
    },
    email: {
      required: true,
      type: 'string',
      isEmail: true
    }
  };

  test('should validate correct data successfully', () => {
    const result = validateRequestData(testValidData, validationRules);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject invalid data with appropriate errors', () => {
    const result = validateRequestData(testInvalidData, validationRules);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('password must be at least 8 characters');
    expect(result.errors).toContain('email must be a valid email');
  });

  test('should validate nested object structures', () => {
    const nestedRules = {
      user: {
        required: true,
        type: 'object',
        schema: {
          name: { required: true, type: 'string' },
          settings: {
            required: true,
            type: 'object',
            schema: {
              theme: { required: true, type: 'string' }
            }
          }
        }
      }
    };

    const validNestedData = {
      user: {
        name: 'John',
        settings: {
          theme: 'dark'
        }
      }
    };

    const result = validateRequestData(validNestedData, nestedRules);
    expect(result.isValid).toBe(true);
  });

  test('should handle custom validation functions', () => {
    const customRules = {
      age: {
        required: true,
        type: 'number',
        validate: (value: number) => value >= 18 ? true : 'Must be 18 or older'
      }
    };

    expect(validateRequestData({ age: 20 }, customRules).isValid).toBe(true);
    expect(validateRequestData({ age: 16 }, customRules).isValid).toBe(false);
  });

  test('should handle missing required fields', () => {
    const result = validateRequestData({}, validationRules);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('username is required');
    expect(result.errors).toContain('password is required');
    expect(result.errors).toContain('email is required');
  });
});
import helmet from 'helmet'; // v7.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import xss from 'xss'; // v1.0.14
import validator from 'validator'; // v13.9.0
import { SECURITY } from '../config/constants';

// Default security constants
const DEFAULT_CSP = "default-src 'self'; connect-src 'self' wss://*.home-assistant.io";
const DEFAULT_HSTS = 'max-age=31536000; includeSubDomains';
const DEFAULT_REFERRER = 'strict-origin-when-cross-origin';

/**
 * Returns comprehensive security headers configuration for the application
 * Implements strict security policies following OWASP guidelines
 * @returns {object} Security headers configuration object
 */
export const getSecurityHeaders = () => ({
  'Content-Security-Policy': DEFAULT_CSP,
  'Strict-Transport-Security': DEFAULT_HSTS,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': DEFAULT_REFERRER,
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-Download-Options': 'noopen',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
});

/**
 * Returns advanced rate limiting configuration with sliding window
 * Implements IP-based restrictions and custom key generation
 * @returns {object} Rate limit configuration object
 */
export const getRateLimitConfig = () => ({
  windowMs: SECURITY.RATE_LIMIT_WINDOW,
  max: SECURITY.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req: any) => {
    return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  },
  handler: (req: any, res: any) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(SECURITY.RATE_LIMIT_WINDOW / 1000)
    });
  },
  skip: (req: any) => {
    // Skip rate limiting for health check endpoints
    return req.path === '/health' || req.path === '/ping';
  }
});

/**
 * Comprehensive input sanitization with support for nested objects
 * @param {any} input - Input data to sanitize
 * @returns {any} Sanitized input data
 */
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    return xss(input, {
      whiteList: {}, // Disable all HTML tags
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
      css: false
    });
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }

  if (input && typeof input === 'object') {
    const sanitized: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
};

/**
 * Advanced request data validation with nested validation support
 * @param {object} data - Request data to validate
 * @param {object} rules - Validation rules configuration
 * @returns {object} Validation results with detailed errors
 */
export const validateRequestData = (
  data: { [key: string]: any },
  rules: { [key: string]: any }
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value !== undefined && value !== null) {
      // Type validation
      if (rule.type && typeof value !== rule.type) {
        errors.push(`${field} must be of type ${rule.type}`);
      }

      // String-specific validations
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${field} must not exceed ${rule.maxLength} characters`);
        }
        if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
          errors.push(`${field} format is invalid`);
        }
        if (rule.isEmail && !validator.isEmail(value)) {
          errors.push(`${field} must be a valid email`);
        }
        if (rule.isURL && !validator.isURL(value)) {
          errors.push(`${field} must be a valid URL`);
        }
      }

      // Number-specific validations
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${field} must not exceed ${rule.max}`);
        }
      }

      // Custom validation function
      if (rule.validate && typeof rule.validate === 'function') {
        try {
          const result = rule.validate(value);
          if (result !== true) {
            errors.push(result || `${field} validation failed`);
          }
        } catch (error) {
          errors.push(`${field} validation error: ${error.message}`);
        }
      }

      // Nested object validation
      if (rule.schema && typeof value === 'object') {
        const nestedValidation = validateRequestData(value, rule.schema);
        errors.push(...nestedValidation.errors.map(err => `${field}.${err}`));
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
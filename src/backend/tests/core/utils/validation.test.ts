import { describe, it, expect, jest } from '@jest/globals'; // v29.0.0
import {
  validateHAMessage,
  validateFloorPlan,
  validatePlugin,
  validateEntityPlacement
} from '../../../src/core/utils/validation';
import { HAMessageType, HAWebSocketMessage } from '../../../src/types/homeAssistant';
import { IFloorPlan } from '../../../src/core/interfaces/IFloorPlan';
import { IPlugin, PluginState } from '../../../src/core/interfaces/IPlugin';

// Test data constants
const validHAMessage: HAWebSocketMessage = {
  type: 'auth',
  id: 1,
  payload: {
    access_token: 'valid_token_123',
    expires_at: '2024-12-31T23:59:59Z'
  }
};

const validFloorPlan: IFloorPlan = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Ground Floor',
  svgData: '<svg width="800" height="600"></svg>',
  dimensions: {
    width: 800,
    height: 600
  },
  scale: 1.0,
  order: 0,
  entityPlacements: [
    {
      entityId: 'light.living_room',
      x: 100,
      y: 100,
      scale: 1.0
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
};

const validPlugin: IPlugin = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Plugin',
  version: '1.0.0',
  state: PluginState.INACTIVE,
  description: 'Test plugin for validation',
  author: 'Test Author',
  config: {},
  initialize: async () => {},
  cleanup: async () => {}
};

describe('validateHAMessage', () => {
  // Message structure validation
  it('should validate a well-formed HA message', async () => {
    const result = await validateHAMessage(validHAMessage);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject messages exceeding size limit', async () => {
    const largeMessage = {
      ...validHAMessage,
      payload: { data: 'x'.repeat(2 * 1024 * 1024) }
    };
    const result = await validateHAMessage(largeMessage);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('exceeds maximum limit');
  });

  // Security validation
  it('should sanitize potentially harmful message content', async () => {
    const maliciousMessage = {
      ...validHAMessage,
      payload: {
        access_token: '<script>alert("xss")</script>'
      }
    };
    const result = await validateHAMessage(maliciousMessage);
    expect(result.isValid).toBe(false);
  });

  // Performance testing
  it('should validate messages within performance threshold', async () => {
    const start = performance.now();
    await validateHAMessage(validHAMessage);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // 100ms threshold
  });

  // Rate limiting
  it('should enforce rate limiting', async () => {
    const messages = Array(1001).fill(validHAMessage);
    const results = await Promise.all(messages.map(validateHAMessage));
    const rejectedCount = results.filter(r => !r.isValid).length;
    expect(rejectedCount).toBeGreaterThan(0);
  });
});

describe('validateFloorPlan', () => {
  // SVG security validation
  it('should detect malicious SVG content', async () => {
    const maliciousFloorPlan = {
      ...validFloorPlan,
      svgData: '<svg><script>alert("xss")</script></svg>'
    };
    const result = await validateFloorPlan(maliciousFloorPlan);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Invalid SVG format');
  });

  // Dimension validation
  it('should validate entity placement boundaries', async () => {
    const invalidPlacement = {
      ...validFloorPlan,
      entityPlacements: [{
        entityId: 'light.test',
        x: 1000, // Exceeds width
        y: 100,
        scale: 1.0
      }]
    };
    const result = await validateFloorPlan(invalidPlacement);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('exceed floor plan dimensions');
  });

  // Cache verification
  it('should utilize validation cache for repeated validations', async () => {
    const firstResult = await validateFloorPlan(validFloorPlan);
    const start = performance.now();
    const secondResult = await validateFloorPlan(validFloorPlan);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10); // Cache should be very fast
    expect(secondResult).toEqual(firstResult);
  });

  // Performance testing
  it('should handle large floor plans efficiently', async () => {
    const largeFloorPlan = {
      ...validFloorPlan,
      entityPlacements: Array(500).fill(validFloorPlan.entityPlacements[0])
    };
    const start = performance.now();
    await validateFloorPlan(largeFloorPlan);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200); // 200ms threshold
  });
});

describe('validatePlugin', () => {
  // Security scanning
  it('should detect unsafe plugin code', async () => {
    const unsafePlugin = {
      ...validPlugin,
      initialize: async () => { eval('console.log("unsafe")'); }
    };
    const result = await validatePlugin(unsafePlugin);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('unsafe code');
  });

  // Method validation
  it('should verify required plugin methods', async () => {
    const incompletePlugin = {
      ...validPlugin,
      cleanup: undefined
    };
    const result = await validatePlugin(incompletePlugin);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Missing required plugin methods');
  });

  // Version compatibility
  it('should validate semantic versioning', async () => {
    const invalidVersionPlugin = {
      ...validPlugin,
      version: '1.0'
    };
    const result = await validatePlugin(invalidVersionPlugin);
    expect(result.isValid).toBe(false);
  });

  // Performance testing
  it('should validate plugins within performance threshold', async () => {
    const start = performance.now();
    await validatePlugin(validPlugin);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // 100ms threshold
  });
});

describe('Concurrent Validation', () => {
  it('should handle multiple concurrent validations', async () => {
    const validations = [
      validateHAMessage(validHAMessage),
      validateFloorPlan(validFloorPlan),
      validatePlugin(validPlugin)
    ];
    
    const results = await Promise.all(validations);
    expect(results.every(r => r.isValid)).toBe(true);
  });

  it('should maintain rate limits across concurrent requests', async () => {
    const validations = Array(1200).fill(null).map(() => 
      validateHAMessage(validHAMessage)
    );
    
    const results = await Promise.all(validations);
    const rejectedCount = results.filter(r => !r.isValid).length;
    expect(rejectedCount).toBeGreaterThan(0);
  });
});

describe('Error Handling', () => {
  it('should handle validation timeouts gracefully', async () => {
    jest.useFakeTimers();
    const validationPromise = validateHAMessage(validHAMessage);
    jest.advanceTimersByTime(6000); // Exceed 5s timeout
    const result = await validationPromise;
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('timeout');
    jest.useRealTimers();
  });

  it('should provide detailed error messages', async () => {
    const invalidMessage = {
      type: 'invalid_type' as HAMessageType,
      id: -1
    };
    const result = await validateHAMessage(invalidMessage);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toBeTruthy();
    expect(typeof result.errors[0]).toBe('string');
  });
});
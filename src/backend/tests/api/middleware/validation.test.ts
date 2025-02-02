import { Request, Response, NextFunction } from 'express'; // v4.18.0
import supertest from 'supertest'; // v6.0.0
import { jest } from '@jest/globals'; // v29.0.0
import {
  validateRequest,
  validateFloorPlanRequest,
  validatePluginOperationRequest,
  validateStateUpdateRequest
} from '../../../src/api/middleware/validation';
import { FloorPlanValidationError } from '../../../core/types/FloorPlan.types';
import { PluginState } from '../../../core/interfaces/IPlugin';

// Test data constants
const VALID_FLOOR_PLAN_DATA = {
  name: 'Ground Floor',
  svgData: '<svg width="800" height="600"></svg>',
  dimensions: {
    width: 800,
    height: 600
  },
  scale: 1,
  entityPlacements: [
    {
      entityId: 'light.living_room',
      x: 100,
      y: 200,
      scale: 1
    }
  ]
};

const INVALID_FLOOR_PLAN_DATA = {
  name: '',
  svgData: '<div>Invalid SVG</div>',
  dimensions: {
    width: -1,
    height: 0
  }
};

const VALID_PLUGIN_DATA = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Plugin',
  version: '1.0.0',
  state: PluginState.INACTIVE,
  description: 'Test plugin description',
  author: 'Test Author',
  config: {}
};

const VALID_STATE_UPDATE = {
  entityId: 'light.living_room',
  state: 'on',
  attributes: {
    brightness: 255
  }
};

// Mock request/response/next function factory
const createMockRequestResponse = () => {
  const req = {
    body: {},
    ip: '127.0.0.1',
    headers: {},
    validationMeta: {}
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next };
};

describe('validateRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should pass validation with valid request body', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.body = { test: 'valid data' };

    await validateRequest(req, res, next, {
      schema: expect.any(Object),
      skipCache: true
    });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should handle rate limiting', async () => {
    const { req, res, next } = createMockRequestResponse();
    
    // Simulate rate limit exceeded
    for (let i = 0; i < 1001; i++) {
      await validateRequest(req, res, next, { skipCache: true });
    }

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED'
      })
    }));
  });

  test('should validate payload size', async () => {
    const { req, res, next } = createMockRequestResponse();
    const largeData = new Array(6 * 1024 * 1024).fill('x').join('');
    req.body = { data: largeData };

    await validateRequest(req, res, next, { skipCache: true });

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'PAYLOAD_TOO_LARGE'
      })
    }));
  });

  test('should handle validation timeout', async () => {
    const { req, res, next } = createMockRequestResponse();
    
    await validateRequest(req, res, next, {
      customValidation: async () => {
        await new Promise(resolve => setTimeout(resolve, 6000));
        return true;
      }
    });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR'
      })
    }));
  });
});

describe('validateFloorPlanRequest', () => {
  test('should validate floor plan creation request', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.method = 'POST';
    req.body = VALID_FLOOR_PLAN_DATA;

    await validateFloorPlanRequest(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should reject invalid floor plan data', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.method = 'POST';
    req.body = INVALID_FLOOR_PLAN_DATA;

    await validateFloorPlanRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'INVALID_FLOOR_PLAN_DATA'
      })
    }));
  });

  test('should validate SVG security', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.method = 'POST';
    req.body = {
      ...VALID_FLOOR_PLAN_DATA,
      svgData: '<svg><script>alert("xss")</script></svg>'
    };

    await validateFloorPlanRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'SVG_SECURITY_ERROR'
      })
    }));
  });
});

describe('validatePluginOperationRequest', () => {
  test('should validate plugin installation request', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.method = 'POST';
    req.body = VALID_PLUGIN_DATA;

    await validatePluginOperationRequest(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should validate plugin security', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.method = 'POST';
    req.body = {
      ...VALID_PLUGIN_DATA,
      config: {
        code: 'eval("malicious code")'
      }
    };

    await validatePluginOperationRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'PLUGIN_SECURITY_ERROR'
      })
    }));
  });

  test('should validate version compatibility', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.method = 'POST';
    req.body = {
      ...VALID_PLUGIN_DATA,
      version: 'invalid.version'
    };

    await validatePluginOperationRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'INVALID_VERSION_FORMAT'
      })
    }));
  });
});

describe('validateStateUpdateRequest', () => {
  test('should validate state update payload', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.body = VALID_STATE_UPDATE;

    await validateStateUpdateRequest(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should validate entity state transitions', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.body = {
      ...VALID_STATE_UPDATE,
      state: 'invalid_state'
    };

    await validateStateUpdateRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'INVALID_STATE_TRANSITION'
      })
    }));
  });

  test('should handle concurrent updates', async () => {
    const { req, res, next } = createMockRequestResponse();
    req.body = VALID_STATE_UPDATE;

    const promises = Array(5).fill(null).map(() => 
      validateStateUpdateRequest(req, res, next)
    );

    await Promise.all(promises);

    expect(next).toHaveBeenCalledTimes(5);
  });
});
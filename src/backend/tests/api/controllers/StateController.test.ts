/**
 * @file StateController.test.ts
 * @version 1.0.0
 * 
 * Comprehensive test suite for StateController, verifying REST API endpoints
 * for entity state management with focus on performance, security, and reliability.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { Container } from 'inversify';
import supertest from 'supertest';
import { StateController } from '../../../src/api/controllers/StateController';
import { StateService } from '../../../src/core/services/StateService';
import { HAEntityState } from '../../../src/types/homeAssistant';
import { StateError, StateErrorCode } from '../../../src/core/types/State.types';

// Mock StateService
jest.mock('../../../src/core/services/StateService');

// Test constants
const TEST_TIMEOUT = 200; // 200ms latency requirement
const TEST_ENTITY_ID = 'light.living_room';
const TEST_STATE: HAEntityState = {
  entity_id: TEST_ENTITY_ID,
  state: 'on',
  attributes: {
    brightness: 255,
    color_temp: 400
  },
  context: {
    id: '123',
    parent_id: null,
    user_id: 'user123'
  },
  last_changed: '2023-01-01T00:00:00Z',
  last_updated: '2023-01-01T00:00:00Z'
};

describe('StateController', () => {
  let container: Container;
  let stateController: StateController;
  let mockStateService: jest.Mocked<StateService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;

  beforeEach(() => {
    // Set up container and mocks
    container = new Container();
    mockStateService = {
      getState: jest.fn(),
      getAllStates: jest.fn(),
      setState: jest.fn(),
      subscribeToState: jest.fn(),
      unsubscribeFromState: jest.fn()
    } as unknown as jest.Mocked<StateService>;

    // Configure response spies
    jsonSpy = jest.fn().mockReturnThis();
    statusSpy = jest.fn().mockReturnThis();
    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
      setHeader: jest.fn(),
      getHeader: jest.fn()
    };

    // Bind dependencies
    container.bind(StateController).toSelf();
    container.bind(StateService).toConstantValue(mockStateService);

    stateController = container.get(StateController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getState', () => {
    test('should return entity state within 200ms', async () => {
      // Arrange
      mockRequest = {
        params: { entityId: TEST_ENTITY_ID }
      };
      mockStateService.getState.mockResolvedValue(TEST_STATE);

      // Act
      const startTime = Date.now();
      await stateController.getState(mockRequest as Request, mockResponse as Response);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(TEST_TIMEOUT);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(TEST_STATE);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', expect.any(String));
    });

    test('should handle non-existent entity', async () => {
      // Arrange
      mockRequest = {
        params: { entityId: 'nonexistent.entity' }
      };
      mockStateService.getState.mockRejectedValue(
        new StateError({
          code: StateErrorCode.STATE_NOT_FOUND,
          message: 'Entity not found',
          details: { entityId: 'nonexistent.entity' }
        })
      );

      // Act
      await stateController.getState(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Entity not found',
        code: StateErrorCode.STATE_NOT_FOUND
      }));
    });

    test('should validate entity ID format', async () => {
      // Arrange
      mockRequest = {
        params: { entityId: 'invalid_format' }
      };

      // Act
      await stateController.getState(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid entity ID format',
        code: StateErrorCode.INVALID_ENTITY_ID
      }));
    });

    test('should handle rate limiting', async () => {
      // Arrange
      const requests = Array(101).fill(null);
      mockRequest = {
        params: { entityId: TEST_ENTITY_ID }
      };

      // Act & Assert
      for (const _ of requests) {
        await stateController.getState(mockRequest as Request, mockResponse as Response);
      }

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Too many requests'
      }));
    });
  });

  describe('getAllStates', () => {
    test('should return all states with pagination within 200ms', async () => {
      // Arrange
      const states = Array(100).fill(TEST_STATE);
      mockRequest = {
        query: { page: '1', limit: '50' }
      };
      mockStateService.getAllStates.mockResolvedValue(states);

      // Act
      const startTime = Date.now();
      await stateController.getAllStates(mockRequest as Request, mockResponse as Response);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(TEST_TIMEOUT);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.any(Array),
        pagination: expect.any(Object)
      }));
    });

    test('should handle domain filtering', async () => {
      // Arrange
      const states = [
        { ...TEST_STATE, entity_id: 'light.living_room' },
        { ...TEST_STATE, entity_id: 'switch.kitchen' }
      ];
      mockRequest = {
        query: { domain: 'light' }
      };
      mockStateService.getAllStates.mockResolvedValue(states);

      // Act
      await stateController.getAllStates(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ entity_id: 'light.living_room' })
        ])
      }));
    });

    test('should validate pagination parameters', async () => {
      // Arrange
      mockRequest = {
        query: { page: '0', limit: '1000' }
      };

      // Act
      await stateController.getAllStates(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid pagination parameters'
      }));
    });
  });

  describe('setState', () => {
    test('should update entity state within 200ms', async () => {
      // Arrange
      const stateUpdate = { state: 'off', attributes: { brightness: 0 } };
      mockRequest = {
        params: { entityId: TEST_ENTITY_ID },
        body: stateUpdate
      };
      mockStateService.setState.mockResolvedValue(undefined);

      // Act
      const startTime = Date.now();
      await stateController.setState(mockRequest as Request, mockResponse as Response);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(TEST_TIMEOUT);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        message: 'State updated successfully'
      }));
    });

    test('should validate state update payload', async () => {
      // Arrange
      mockRequest = {
        params: { entityId: TEST_ENTITY_ID },
        body: { invalid: 'payload' }
      };

      // Act
      await stateController.setState(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid state update payload',
        code: StateErrorCode.INVALID_STATE
      }));
    });

    test('should handle update errors', async () => {
      // Arrange
      mockRequest = {
        params: { entityId: TEST_ENTITY_ID },
        body: { state: 'invalid_state' }
      };
      mockStateService.setState.mockRejectedValue(
        new StateError({
          code: StateErrorCode.STATE_UPDATE_TIMEOUT,
          message: 'Update failed',
          details: { entityId: TEST_ENTITY_ID }
        })
      );

      // Act
      await stateController.setState(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Update failed',
        code: StateErrorCode.STATE_UPDATE_TIMEOUT
      }));
    });
  });
});
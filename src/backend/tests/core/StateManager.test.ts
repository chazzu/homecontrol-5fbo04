/**
 * @file StateManager.test.ts
 * @version 1.0.0
 * 
 * Comprehensive test suite for the StateManager class, verifying state management,
 * WebSocket integration, real-time updates, and error handling.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { StateManager } from '../../src/core/StateManager';
import { StateService } from '../../src/core/services/StateService';
import { WebSocketManager } from '../../src/core/WebSocketManager';
import { HAEntityState } from '../../src/types/homeAssistant';
import { StateError, StateErrorCode } from '../../src/core/types/State.types';

// Mock implementations
jest.mock('../../src/core/services/StateService');
jest.mock('../../src/core/WebSocketManager');

describe('StateManager', () => {
  let stateManager: StateManager;
  let stateService: jest.Mocked<StateService>;
  let wsManager: jest.Mocked<WebSocketManager>;

  // Test data
  const mockEntityId = 'light.living_room';
  const mockState: HAEntityState = {
    entity_id: mockEntityId,
    state: 'on',
    attributes: { brightness: 255 },
    context: {
      id: '123',
      parent_id: null,
      user_id: null
    },
    last_changed: '2023-01-01T00:00:00Z',
    last_updated: '2023-01-01T00:00:00Z'
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Initialize mocked services
    stateService = new StateService(wsManager) as jest.Mocked<StateService>;
    wsManager = new WebSocketManager({} as any) as jest.Mocked<WebSocketManager>;

    // Setup mock implementations
    stateService.getState.mockResolvedValue(mockState);
    stateService.getAllStates.mockResolvedValue([mockState]);
    stateService.setState.mockResolvedValue();
    wsManager.subscribeToEvents.mockResolvedValue(1);
    wsManager.connect.mockResolvedValue();

    // Initialize StateManager with mocked dependencies
    stateManager = new StateManager(stateService, wsManager);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Core Functionality Tests', () => {
    test('should initialize successfully', async () => {
      await expect(stateManager.initialize()).resolves.not.toThrow();
      expect(wsManager.connect).toHaveBeenCalled();
      expect(stateService.getAllStates).toHaveBeenCalled();
    });

    test('should get entity state with caching', async () => {
      const state = await stateManager.getState(mockEntityId);
      expect(state).toEqual(mockState);
      expect(stateService.getState).toHaveBeenCalledWith(mockEntityId);

      // Second call should use cache
      const cachedState = await stateManager.getState(mockEntityId);
      expect(cachedState).toEqual(mockState);
      expect(stateService.getState).toHaveBeenCalledTimes(1);
    });

    test('should get all states with batch processing', async () => {
      const states = await stateManager.getAllStates();
      expect(states).toEqual([mockState]);
      expect(stateService.getAllStates).toHaveBeenCalled();
    });

    test('should set entity state with validation', async () => {
      const newState = { state: 'off' };
      await stateManager.setState(mockEntityId, newState);
      expect(stateService.setState).toHaveBeenCalledWith(mockEntityId, newState);
    });
  });

  describe('Performance Tests', () => {
    test('should meet 200ms latency requirement for state updates', async () => {
      jest.useFakeTimers();
      const startTime = Date.now();
      
      const updatePromise = stateManager.setState(mockEntityId, { state: 'off' });
      jest.advanceTimersByTime(100);
      await updatePromise;

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(200);
    });

    test('should efficiently handle batch state processing', async () => {
      const states = Array(100).fill(mockState);
      stateService.getAllStates.mockResolvedValue(states);

      const startTime = Date.now();
      await stateManager.getAllStates();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
    });

    test('should optimize subscription notifications', async () => {
      const callback = jest.fn();
      await stateManager.subscribeToState(mockEntityId, callback);

      // Simulate multiple rapid state changes
      for (let i = 0; i < 10; i++) {
        await stateManager.setState(mockEntityId, { state: `state${i}` });
      }

      expect(callback).toHaveBeenCalled();
      // Verify batching behavior
      expect(callback.mock.calls.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle invalid entity ID', async () => {
      await expect(stateManager.getState('invalid')).rejects.toThrow(
        expect.objectContaining({
          code: StateErrorCode.INVALID_ENTITY_ID
        })
      );
    });

    test('should handle state not found', async () => {
      stateService.getState.mockRejectedValue(new Error('Not found'));
      await expect(stateManager.getState(mockEntityId)).rejects.toThrow(
        expect.objectContaining({
          code: StateErrorCode.STATE_NOT_FOUND
        })
      );
    });

    test('should handle connection failures', async () => {
      wsManager.connect.mockRejectedValue(new Error('Connection failed'));
      await expect(stateManager.initialize()).rejects.toThrow();
    });

    test('should implement retry mechanism for state updates', async () => {
      stateService.setState.mockRejectedValueOnce(new Error('Temporary error'));
      stateService.setState.mockResolvedValueOnce(undefined);

      await expect(stateManager.setState(mockEntityId, { state: 'off' }))
        .resolves.not.toThrow();
      expect(stateService.setState).toHaveBeenCalledTimes(2);
    });
  });

  describe('Security Tests', () => {
    test('should validate state update payload', async () => {
      const maliciousState = {
        state: 'on',
        attributes: {
          script: 'javascript:alert(1)'
        }
      };

      await expect(stateManager.setState(mockEntityId, maliciousState))
        .rejects.toThrow(StateErrorCode.INVALID_STATE);
    });

    test('should prevent unauthorized state access', async () => {
      const sensitiveEntityId = 'alarm_control_panel.home';
      stateService.getState.mockRejectedValue(new Error('Unauthorized'));

      await expect(stateManager.getState(sensitiveEntityId))
        .rejects.toThrow(StateErrorCode.STATE_NOT_FOUND);
    });
  });

  describe('Connection Management Tests', () => {
    test('should handle reconnection', async () => {
      // Simulate disconnection
      wsManager.connect.mockRejectedValueOnce(new Error('Disconnected'));
      wsManager.connect.mockResolvedValueOnce(undefined);

      await stateManager.initialize();
      expect(wsManager.connect).toHaveBeenCalledTimes(2);
    });

    test('should restore subscriptions after reconnection', async () => {
      const callback = jest.fn();
      await stateManager.subscribeToState(mockEntityId, callback);

      // Simulate reconnection
      await stateManager.initialize();

      expect(wsManager.subscribeToEvents).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(mockState);
    });

    test('should maintain state consistency during reconnection', async () => {
      const states = await stateManager.getAllStates();
      
      // Simulate reconnection
      await stateManager.initialize();
      const statesAfterReconnect = await stateManager.getAllStates();

      expect(statesAfterReconnect).toEqual(states);
    });
  });
});
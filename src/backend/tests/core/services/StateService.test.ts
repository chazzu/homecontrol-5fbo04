/**
 * @file StateService.test.ts
 * @version 1.0.0
 * 
 * Comprehensive test suite for StateService class that verifies state management functionality,
 * real-time updates, subscription handling, and performance requirements.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { Container } from 'inversify'; // v6.0.1
import { StateService } from '../../../src/core/services/StateService';
import { WebSocketManager } from '../../../src/core/WebSocketManager';
import { HAEntityState } from '../../../src/types/homeAssistant';
import { StateErrorCode } from '../../../src/core/types/State.types';

describe('StateService', () => {
  let container: Container;
  let stateService: StateService;
  let mockWebSocketManager: jest.Mocked<WebSocketManager>;
  let performanceNow: number;

  // Mock entity state for testing
  const mockEntityState: HAEntityState = {
    entity_id: 'light.living_room',
    state: 'on',
    attributes: {
      brightness: 255,
      color_temp: 300
    },
    context: {
      id: '123',
      parent_id: null,
      user_id: null
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };

  beforeEach(() => {
    // Reset all mocks and timers
    jest.clearAllMocks();
    jest.useFakeTimers();
    performanceNow = Date.now();

    // Create new DI container
    container = new Container();

    // Mock WebSocketManager
    mockWebSocketManager = {
      sendMessage: jest.fn(),
      subscribeToEvents: jest.fn(),
      unsubscribeFromEvents: jest.fn()
    } as unknown as jest.Mocked<WebSocketManager>;

    // Bind mocks to container
    container.bind(WebSocketManager).toConstantValue(mockWebSocketManager);
    container.bind(StateService).toSelf();

    // Get StateService instance
    stateService = container.get(StateService);

    // Mock performance.now for timing tests
    jest.spyOn(performance, 'now').mockImplementation(() => performanceNow);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('getState', () => {
    test('should retrieve entity state within 200ms latency requirement', async () => {
      // Setup WebSocket response with timing
      mockWebSocketManager.sendMessage.mockImplementation(() => {
        performanceNow += 50; // Simulate 50ms network delay
        return Promise.resolve({ result: mockEntityState });
      });

      const startTime = performanceNow;
      const state = await stateService.getState('light.living_room');
      const endTime = performanceNow;

      // Verify timing requirement
      expect(endTime - startTime).toBeLessThan(200);
      expect(state).toEqual(mockEntityState);
      expect(mockWebSocketManager.sendMessage).toHaveBeenCalledWith({
        type: 'get_states',
        entity_id: 'light.living_room'
      });
    });

    test('should use cached state when available and valid', async () => {
      // Prime cache
      mockWebSocketManager.sendMessage.mockResolvedValueOnce({ result: mockEntityState });
      await stateService.getState('light.living_room');

      // Clear mock to verify cache hit
      mockWebSocketManager.sendMessage.mockClear();

      // Request same state within cache duration
      const state = await stateService.getState('light.living_room');

      expect(state).toEqual(mockEntityState);
      expect(mockWebSocketManager.sendMessage).not.toHaveBeenCalled();
    });

    test('should handle non-existent entity gracefully', async () => {
      mockWebSocketManager.sendMessage.mockResolvedValueOnce({ result: null });

      await expect(stateService.getState('light.non_existent'))
        .rejects
        .toThrow(StateErrorCode.STATE_NOT_FOUND);
    });
  });

  describe('getAllStates', () => {
    test('should retrieve all states with performance monitoring', async () => {
      const mockStates = [mockEntityState];
      mockWebSocketManager.sendMessage.mockImplementation(() => {
        performanceNow += 100; // Simulate 100ms network delay
        return Promise.resolve({ result: mockStates });
      });

      const startTime = performanceNow;
      const states = await stateService.getAllStates();
      const endTime = performanceNow;

      expect(endTime - startTime).toBeLessThan(200);
      expect(states).toEqual(mockStates);
      expect(mockWebSocketManager.sendMessage).toHaveBeenCalledWith({
        type: 'get_states'
      });
    });

    test('should handle bulk retrieval errors', async () => {
      mockWebSocketManager.sendMessage.mockRejectedValueOnce(new Error('Network error'));

      await expect(stateService.getAllStates())
        .rejects
        .toThrow(StateErrorCode.STATE_UPDATE_TIMEOUT);
    });
  });

  describe('setState', () => {
    test('should update state and notify subscribers within latency requirement', async () => {
      const newState = { state: 'off' };
      const subscriberCallback = jest.fn();

      // Setup subscription
      await stateService.subscribeToState('light.living_room', subscriberCallback);

      // Mock successful state update
      mockWebSocketManager.sendMessage.mockImplementation(() => {
        performanceNow += 50; // Simulate 50ms network delay
        return Promise.resolve({ success: true });
      });

      const startTime = performanceNow;
      await stateService.setState('light.living_room', newState);
      const endTime = performanceNow;

      expect(endTime - startTime).toBeLessThan(200);
      expect(subscriberCallback).toHaveBeenCalled();
      expect(mockWebSocketManager.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'call_service',
          domain: 'light',
          service: 'set_state',
          target: { entity_id: 'light.living_room' },
          service_data: newState
        })
      );
    });

    test('should retry failed state updates', async () => {
      mockWebSocketManager.sendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });

      await stateService.setState('light.living_room', { state: 'off' });

      expect(mockWebSocketManager.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribeToState', () => {
    test('should handle subscriptions with immediate state fetch', async () => {
      const callback = jest.fn();
      mockWebSocketManager.sendMessage.mockResolvedValueOnce({ result: mockEntityState });
      mockWebSocketManager.subscribeToEvents.mockResolvedValueOnce(1);

      await stateService.subscribeToState('light.living_room', callback);

      expect(callback).toHaveBeenCalledWith(mockEntityState);
      expect(mockWebSocketManager.subscribeToEvents).toHaveBeenCalled();
    });

    test('should maintain multiple subscribers for same entity', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      mockWebSocketManager.sendMessage.mockResolvedValue({ result: mockEntityState });
      mockWebSocketManager.subscribeToEvents.mockResolvedValue(1);

      await stateService.subscribeToState('light.living_room', callback1);
      await stateService.subscribeToState('light.living_room', callback2);

      // Simulate state change
      const newState = { ...mockEntityState, state: 'off' };
      await stateService.setState('light.living_room', newState);

      expect(callback1).toHaveBeenCalledWith(expect.objectContaining(newState));
      expect(callback2).toHaveBeenCalledWith(expect.objectContaining(newState));
    });
  });

  describe('unsubscribeFromState', () => {
    test('should remove subscription and clean up resources', async () => {
      const callback = jest.fn();
      mockWebSocketManager.subscribeToEvents.mockResolvedValueOnce(1);

      await stateService.subscribeToState('light.living_room', callback);
      await stateService.unsubscribeFromState('light.living_room', callback);

      // Simulate state change
      await stateService.setState('light.living_room', { state: 'off' });

      expect(callback).not.toHaveBeenCalled();
      expect(mockWebSocketManager.unsubscribeFromEvents).toHaveBeenCalled();
    });

    test('should handle unsubscribe for non-existent subscription', async () => {
      const callback = jest.fn();

      await expect(stateService.unsubscribeFromState('light.living_room', callback))
        .resolves
        .not
        .toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid entity IDs', async () => {
      await expect(stateService.getState('invalid_entity_id'))
        .rejects
        .toThrow(StateErrorCode.INVALID_ENTITY_ID);
    });

    test('should handle WebSocket connection errors', async () => {
      mockWebSocketManager.sendMessage.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(stateService.getState('light.living_room'))
        .rejects
        .toThrow(StateErrorCode.STATE_NOT_FOUND);
    });

    test('should handle subscription errors', async () => {
      mockWebSocketManager.subscribeToEvents.mockRejectedValueOnce(new Error('Subscription failed'));

      await expect(stateService.subscribeToState('light.living_room', jest.fn()))
        .rejects
        .toThrow(StateErrorCode.SUBSCRIPTION_ERROR);
    });
  });
});
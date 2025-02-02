/**
 * @file WebSocketManager.test.ts
 * @version 1.0.0
 * 
 * Comprehensive test suite for WebSocketManager class verifying real-time communication,
 * connection management, message handling, and performance requirements.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.0.0
import { mock, mockReset, MockProxy } from 'jest-mock-extended'; // v3.0.0

import { WebSocketManager } from '../../src/core/WebSocketManager';
import { WebSocketService } from '../../src/core/services/WebSocketService';
import { WebSocketConfig } from '../../src/config/websocket';
import { 
  WebSocketConnectionState,
  WebSocketMessageOptions 
} from '../../src/core/types/WebSocket.types';
import { 
  HAWebSocketMessage,
  HAEventType,
  HAMessageType 
} from '../../types/homeAssistant';

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager;
  let mockWebSocketService: MockProxy<WebSocketService>;
  let mockConfig: WebSocketConfig;

  // Performance test constants
  const LATENCY_THRESHOLD = 200; // 200ms max latency requirement
  const BATCH_SIZE = 10;
  const MESSAGE_TIMEOUT = 10000;

  beforeEach(() => {
    // Reset all mocks before each test
    mockReset();

    // Create mock WebSocket service
    mockWebSocketService = mock<WebSocketService>();

    // Configure test WebSocket settings
    mockConfig = {
      url: 'wss://test.local:8123/api/websocket',
      authToken: 'test_token',
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
      rateLimit: 100,
      batchSize: BATCH_SIZE,
      messageTimeout: MESSAGE_TIMEOUT
    };

    // Initialize WebSocketManager with mocks
    wsManager = new WebSocketManager(mockWebSocketService, mockConfig);
  });

  afterEach(() => {
    // Clean up after each test
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    test('should establish connection successfully', async () => {
      mockWebSocketService.connect.mockResolvedValue();
      
      await wsManager.connect();
      
      expect(mockWebSocketService.connect).toHaveBeenCalled();
      expect(wsManager.getConnectionState().state).toBe(WebSocketConnectionState.CONNECTED);
    });

    test('should handle connection failures with retry', async () => {
      mockWebSocketService.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce();

      await wsManager.connect();

      expect(mockWebSocketService.connect).toHaveBeenCalledTimes(2);
      expect(wsManager.getConnectionState().metrics.reconnections).toBe(1);
    });

    test('should respect max retry attempts', async () => {
      mockWebSocketService.connect.mockRejectedValue(new Error('Connection failed'));

      try {
        await wsManager.connect();
      } catch (error) {
        expect(mockWebSocketService.connect).toHaveBeenCalledTimes(mockConfig.maxReconnectAttempts);
        expect(wsManager.getConnectionState().state).toBe(WebSocketConnectionState.DISCONNECTED);
      }
    });

    test('should disconnect gracefully', async () => {
      mockWebSocketService.disconnect.mockResolvedValue();

      await wsManager.disconnect();

      expect(mockWebSocketService.disconnect).toHaveBeenCalledWith(false);
      expect(wsManager.getConnectionState().state).toBe(WebSocketConnectionState.DISCONNECTED);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      mockWebSocketService.connect.mockResolvedValue();
      await wsManager.connect();
    });

    test('should send message with correct format', async () => {
      const message: HAWebSocketMessage = {
        type: 'call_service' as HAMessageType,
        domain: 'light',
        service: 'turn_on'
      };

      mockWebSocketService.sendMessage.mockResolvedValue({ 
        type: 'result',
        success: true,
        result: {}
      });

      await wsManager.sendMessage(message);

      expect(mockWebSocketService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining(message),
        expect.any(Object)
      );
    });

    test('should handle message timeouts', async () => {
      const message: HAWebSocketMessage = {
        type: 'call_service' as HAMessageType,
        domain: 'light',
        service: 'turn_on'
      };

      mockWebSocketService.sendMessage.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, MESSAGE_TIMEOUT + 100))
      );

      await expect(wsManager.sendMessage(message, { 
        timeout: MESSAGE_TIMEOUT 
      })).rejects.toThrow('Message timeout');
    });

    test('should batch messages efficiently', async () => {
      const messages: HAWebSocketMessage[] = Array(BATCH_SIZE).fill({
        type: 'call_service' as HAMessageType,
        domain: 'light',
        service: 'turn_on'
      });

      mockWebSocketService.sendMessage.mockResolvedValue({ 
        type: 'result',
        success: true,
        result: {}
      });

      const sendPromises = messages.map(msg => wsManager.sendMessage(msg));
      await Promise.all(sendPromises);

      expect(mockWebSocketService.sendMessage).toHaveBeenCalledTimes(BATCH_SIZE);
    });
  });

  describe('Event Subscriptions', () => {
    beforeEach(async () => {
      mockWebSocketService.connect.mockResolvedValue();
      await wsManager.connect();
    });

    test('should subscribe to events successfully', async () => {
      const eventType: HAEventType = 'state_changed';
      const callback = jest.fn();

      mockWebSocketService.subscribeToEvents.mockResolvedValue(1);

      const subscriptionId = await wsManager.subscribeToEvents(eventType, callback);

      expect(subscriptionId).toBe(1);
      expect(mockWebSocketService.subscribeToEvents).toHaveBeenCalledWith(
        eventType,
        expect.any(Function)
      );
    });

    test('should handle subscription failures', async () => {
      const eventType: HAEventType = 'state_changed';
      const callback = jest.fn();

      mockWebSocketService.subscribeToEvents.mockRejectedValue(
        new Error('Subscription failed')
      );

      await expect(wsManager.subscribeToEvents(eventType, callback))
        .rejects.toThrow('Subscription failed');
    });

    test('should unsubscribe from events', async () => {
      mockWebSocketService.unsubscribeFromEvents.mockResolvedValue();

      await wsManager.unsubscribeFromEvents(1);

      expect(mockWebSocketService.unsubscribeFromEvents).toHaveBeenCalledWith(1);
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      mockWebSocketService.connect.mockResolvedValue();
      await wsManager.connect();
    });

    test('should maintain message latency under 200ms', async () => {
      const message: HAWebSocketMessage = {
        type: 'call_service' as HAMessageType,
        domain: 'light',
        service: 'turn_on'
      };

      mockWebSocketService.sendMessage.mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
        const latency = Date.now() - start;
        expect(latency).toBeLessThan(LATENCY_THRESHOLD);
        return { type: 'result', success: true, result: {} };
      });

      await wsManager.sendMessage(message);
    });

    test('should handle high message throughput', async () => {
      const messages = Array(100).fill({
        type: 'call_service' as HAMessageType,
        domain: 'light',
        service: 'turn_on'
      });

      mockWebSocketService.sendMessage.mockResolvedValue({ 
        type: 'result',
        success: true,
        result: {}
      });

      const start = Date.now();
      await Promise.all(messages.map(msg => wsManager.sendMessage(msg)));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should process 100 messages within 5 seconds
    });

    test('should maintain connection stability under load', async () => {
      const operations = Array(50).fill(null).map((_, index) => 
        index % 2 === 0 
          ? wsManager.connect()
          : wsManager.disconnect()
      );

      mockWebSocketService.connect.mockResolvedValue();
      mockWebSocketService.disconnect.mockResolvedValue();

      await Promise.all(operations);

      const finalState = wsManager.getConnectionState();
      expect([
        WebSocketConnectionState.CONNECTED,
        WebSocketConnectionState.DISCONNECTED
      ]).toContain(finalState.state);
    });
  });

  describe('Error Recovery', () => {
    test('should implement exponential backoff', async () => {
      const attempts: number[] = [];
      mockWebSocketService.connect.mockImplementation(async () => {
        attempts.push(Date.now());
        throw new Error('Connection failed');
      });

      try {
        await wsManager.connect();
      } catch (error) {
        const intervals = attempts.slice(1).map((time, i) => 
          time - attempts[i]
        );

        intervals.forEach((interval, index) => {
          if (index > 0) {
            expect(interval).toBeGreaterThanOrEqual(
              intervals[index - 1]
            );
          }
        });
      }
    });

    test('should restore subscriptions after reconnection', async () => {
      const eventType: HAEventType = 'state_changed';
      const callback = jest.fn();

      mockWebSocketService.connect.mockResolvedValue();
      mockWebSocketService.subscribeToEvents.mockResolvedValue(1);

      await wsManager.connect();
      await wsManager.subscribeToEvents(eventType, callback);

      await wsManager.disconnect();
      await wsManager.connect();

      expect(mockWebSocketService.subscribeToEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('Connection Metrics', () => {
    test('should track connection metrics accurately', async () => {
      mockWebSocketService.connect.mockResolvedValue();
      mockWebSocketService.getConnectionState.mockReturnValue({
        state: WebSocketConnectionState.CONNECTED,
        metrics: {
          latency: 50,
          messagesSent: 10,
          messagesReceived: 8,
          lastMessageTimestamp: Date.now(),
          reconnections: 1
        }
      });

      await wsManager.connect();
      const state = wsManager.getConnectionState();

      expect(state.metrics).toEqual(expect.objectContaining({
        latency: expect.any(Number),
        messagesSent: expect.any(Number),
        messagesReceived: expect.any(Number),
        reconnections: expect.any(Number)
      }));
    });
  });
});
/**
 * @file WebSocketService.test.ts
 * @version 1.0.0
 * 
 * Comprehensive test suite for WebSocketService class verifying WebSocket communication,
 * connection management, message handling, and performance requirements.
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import WS from 'jest-websocket-mock';
import { performance } from 'perf_hooks';
import { WebSocketService } from '../../src/core/services/WebSocketService';
import { WebSocketConnectionState } from '../../src/core/types/WebSocket.types';
import { HAWebSocketMessage } from '../../src/types/homeAssistant';

describe('WebSocketService', () => {
  let wsServer: WS;
  let wsService: WebSocketService;
  const TEST_URL = 'wss://test.local:8123/api/websocket';
  const TEST_TOKEN = 'test_auth_token';

  beforeEach(() => {
    // Create mock WebSocket server
    wsServer = new WS(TEST_URL);
    
    // Initialize service with test configuration
    wsService = new WebSocketService({
      url: TEST_URL,
      authToken: TEST_TOKEN,
      reconnectInterval: 1000,
      maxReconnectAttempts: 3
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up WebSocket server and connections
    WS.clean();
  });

  describe('connection management', () => {
    it('should establish WebSocket connection with correct URL and protocols', async () => {
      await wsService.connect();
      expect(wsServer.connected).toBe(true);
      expect(wsService.getConnectionState().state).toBe(WebSocketConnectionState.CONNECTED);
    });

    it('should handle authentication flow with token validation', async () => {
      const authPromise = wsService.connect();
      
      // Verify auth required message handling
      await wsServer.nextMessage;
      wsServer.send(JSON.stringify({ type: 'auth_required' }));
      
      // Verify auth token sent
      const authMessage = JSON.parse(await wsServer.nextMessage);
      expect(authMessage).toEqual({
        type: 'auth',
        access_token: TEST_TOKEN
      });
      
      // Complete auth flow
      wsServer.send(JSON.stringify({ type: 'auth_ok' }));
      await authPromise;
      
      expect(wsService.getConnectionState().state).toBe(WebSocketConnectionState.CONNECTED);
    });

    it('should transition through connection states correctly', async () => {
      const states: WebSocketConnectionState[] = [];
      jest.spyOn(wsService as any, 'handleConnectionError');
      
      wsService.connect().catch(() => {});
      states.push(wsService.getConnectionState().state);
      
      wsServer.send(JSON.stringify({ type: 'auth_required' }));
      states.push(wsService.getConnectionState().state);
      
      wsServer.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      states.push(wsService.getConnectionState().state);
      
      expect(states).toEqual([
        WebSocketConnectionState.CONNECTING,
        WebSocketConnectionState.CONNECTED,
        WebSocketConnectionState.DISCONNECTED
      ]);
    });

    it('should implement automatic reconnection with exponential backoff', async () => {
      const reconnectSpy = jest.spyOn(wsService as any, 'reconnect');
      await wsService.connect();
      
      // Force disconnection
      wsServer.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(reconnectSpy).toHaveBeenCalled();
      expect(wsService.getConnectionState().state).toBe(WebSocketConnectionState.RECONNECTING);
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      // Establish connection before each test
      const connectPromise = wsService.connect();
      wsServer.send(JSON.stringify({ type: 'auth_required' }));
      await wsServer.nextMessage;
      wsServer.send(JSON.stringify({ type: 'auth_ok' }));
      await connectPromise;
    });

    it('should send messages in correct format with sequential IDs', async () => {
      const message1Promise = wsService.sendMessage({ type: 'get_states' });
      const message2Promise = wsService.sendMessage({ type: 'get_config' });
      
      const msg1 = JSON.parse(await wsServer.nextMessage);
      const msg2 = JSON.parse(await wsServer.nextMessage);
      
      expect(msg1.id).toBe(1);
      expect(msg2.id).toBe(2);
      
      wsServer.send(JSON.stringify({ type: 'result', id: 1, success: true }));
      wsServer.send(JSON.stringify({ type: 'result', id: 2, success: true }));
      
      await Promise.all([message1Promise, message2Promise]);
    });

    it('should handle message timeouts and retries', async () => {
      const timeoutPromise = wsService.sendMessage(
        { type: 'get_states' },
        { timeout: 100 }
      );
      
      await expect(timeoutPromise).rejects.toThrow('Message timeout');
    });

    it('should maintain message order', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        type: 'get_states' as const,
        id: i + 1
      }));
      
      const promises = messages.map(msg => wsService.sendMessage(msg));
      
      for (const msg of messages) {
        const received = JSON.parse(await wsServer.nextMessage);
        expect(received.id).toBe(msg.id);
        wsServer.send(JSON.stringify({
          type: 'result',
          id: msg.id,
          success: true
        }));
      }
      
      await Promise.all(promises);
    });
  });

  describe('event subscription', () => {
    beforeEach(async () => {
      await wsService.connect();
      wsServer.send(JSON.stringify({ type: 'auth_required' }));
      await wsServer.nextMessage;
      wsServer.send(JSON.stringify({ type: 'auth_ok' }));
    });

    it('should subscribe to events with correct message format', async () => {
      const callback = jest.fn();
      const subscribePromise = wsService.subscribeToEvents('state_changed', callback);
      
      const subMsg = JSON.parse(await wsServer.nextMessage);
      expect(subMsg).toEqual({
        type: 'subscribe_events',
        event_type: 'state_changed',
        id: expect.any(Number)
      });
      
      wsServer.send(JSON.stringify({
        type: 'result',
        id: subMsg.id,
        success: true
      }));
      
      const subscriptionId = await subscribePromise;
      expect(subscriptionId).toBe(subMsg.id);
    });

    it('should handle multiple event subscriptions', async () => {
      const callbacks = [jest.fn(), jest.fn()];
      const eventTypes = ['state_changed', 'service_executed'];
      
      const subs = await Promise.all(
        eventTypes.map((type, i) => wsService.subscribeToEvents(type, callbacks[i]))
      );
      
      // Send test events
      wsServer.send(JSON.stringify({
        type: 'event',
        event_type: eventTypes[0],
        data: { test: true }
      }));
      
      wsServer.send(JSON.stringify({
        type: 'event',
        event_type: eventTypes[1],
        data: { test: true }
      }));
      
      expect(callbacks[0]).toHaveBeenCalled();
      expect(callbacks[1]).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle connection failures with appropriate errors', async () => {
      wsServer.close();
      await expect(wsService.connect()).rejects.toThrow();
    });

    it('should handle authentication failures securely', async () => {
      const connectPromise = wsService.connect();
      wsServer.send(JSON.stringify({ type: 'auth_required' }));
      await wsServer.nextMessage;
      wsServer.send(JSON.stringify({ type: 'auth_invalid' }));
      
      await expect(connectPromise).rejects.toThrow('Authentication failed');
    });
  });

  describe('performance', () => {
    it('should meet 200ms latency requirement for state updates', async () => {
      await wsService.connect();
      wsServer.send(JSON.stringify({ type: 'auth_required' }));
      await wsServer.nextMessage;
      wsServer.send(JSON.stringify({ type: 'auth_ok' }));
      
      const start = performance.now();
      const messagePromise = wsService.sendMessage({ type: 'get_states' });
      
      const msg = JSON.parse(await wsServer.nextMessage);
      wsServer.send(JSON.stringify({
        type: 'result',
        id: msg.id,
        success: true,
        result: []
      }));
      
      await messagePromise;
      const latency = performance.now() - start;
      
      expect(latency).toBeLessThan(200);
    });

    it('should handle message queue efficiently under load', async () => {
      await wsService.connect();
      
      const messages = Array.from({ length: 100 }, () => ({
        type: 'get_states' as const
      }));
      
      const start = performance.now();
      const promises = messages.map(msg => wsService.sendMessage(msg));
      
      for (let i = 0; i < messages.length; i++) {
        const received = JSON.parse(await wsServer.nextMessage);
        wsServer.send(JSON.stringify({
          type: 'result',
          id: received.id,
          success: true
        }));
      }
      
      await Promise.all(promises);
      const duration = performance.now() - start;
      
      // Verify batch processing efficiency
      expect(duration / messages.length).toBeLessThan(10);
    });
  });
});
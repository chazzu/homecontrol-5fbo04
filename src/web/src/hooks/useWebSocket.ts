import { useEffect, useCallback, useState } from 'react'; // v18.0.0
import {
  WebSocketService,
  connect,
  disconnect,
  subscribe,
  getConnectionState,
  reconnect,
  validateConnection
} from '../services/websocket';
import {
  WebSocketConfig,
  WebSocketConnectionState,
  WebSocketEventCallback,
  WS_DEFAULT_RECONNECT_INTERVAL,
  WS_MAX_RETRIES
} from '../types/websocket.types';

/**
 * Advanced React hook for managing WebSocket connections with Home Assistant
 * Provides connection pooling, automatic reconnection, and comprehensive state management
 * @param config WebSocket configuration including URL and authentication token
 */
export const useWebSocket = (config: WebSocketConfig) => {
  // Initialize WebSocket service with enhanced configuration
  const [wsService] = useState(() => new WebSocketService({
    ...config,
    reconnectInterval: config.reconnectInterval || WS_DEFAULT_RECONNECT_INTERVAL,
    maxRetries: config.maxRetries || WS_MAX_RETRIES
  }));

  // Track connection state with reconnection states
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>(
    WebSocketConnectionState.DISCONNECTED
  );

  // Track connection metrics
  const [connectionMetrics, setConnectionMetrics] = useState({
    latency: 0,
    reconnectAttempts: 0
  });

  /**
   * Memoized connect function with automatic retry capability
   */
  const connect = useCallback(async () => {
    try {
      setConnectionState(WebSocketConnectionState.CONNECTING);
      await wsService.connect();
      setConnectionState(WebSocketConnectionState.CONNECTED);
      
      // Initialize metrics monitoring
      const metrics = wsService.getConnectionMetrics();
      setConnectionMetrics(current => ({
        ...current,
        latency: metrics.latency
      }));
    } catch (error) {
      setConnectionState(WebSocketConnectionState.ERROR);
      console.error('WebSocket connection failed:', error);
      throw error;
    }
  }, [wsService]);

  /**
   * Memoized disconnect function with cleanup
   */
  const disconnect = useCallback(async () => {
    try {
      await wsService.disconnect();
      setConnectionState(WebSocketConnectionState.DISCONNECTED);
    } catch (error) {
      console.error('WebSocket disconnect failed:', error);
      throw error;
    }
  }, [wsService]);

  /**
   * Type-safe event subscription with automatic cleanup
   */
  const subscribe = useCallback((
    eventType: string,
    callback: WebSocketEventCallback
  ) => {
    if (connectionState !== WebSocketConnectionState.CONNECTED) {
      throw new Error('Cannot subscribe when WebSocket is not connected');
    }
    return wsService.subscribe(eventType, callback);
  }, [wsService, connectionState]);

  /**
   * Manual reconnection with validation
   */
  const reconnect = useCallback(async () => {
    try {
      setConnectionState(WebSocketConnectionState.RECONNECTING);
      await wsService.disconnect();
      await wsService.connect();
      setConnectionMetrics(current => ({
        ...current,
        reconnectAttempts: current.reconnectAttempts + 1
      }));
    } catch (error) {
      setConnectionState(WebSocketConnectionState.ERROR);
      console.error('WebSocket reconnection failed:', error);
      throw error;
    }
  }, [wsService]);

  /**
   * Connection monitoring and automatic reconnection
   */
  useEffect(() => {
    const monitorConnection = setInterval(() => {
      const currentState = wsService.getConnectionState();
      if (currentState !== connectionState) {
        setConnectionState(currentState);
      }

      const metrics = wsService.getConnectionMetrics();
      setConnectionMetrics(current => ({
        ...current,
        latency: metrics.latency
      }));
    }, 1000);

    return () => {
      clearInterval(monitorConnection);
    };
  }, [wsService, connectionState]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      wsService.disconnect().catch(error => {
        console.error('Cleanup disconnect failed:', error);
      });
    };
  }, [wsService]);

  return {
    connectionState,
    connect,
    disconnect,
    subscribe,
    reconnect,
    connectionMetrics
  };
};

export type UseWebSocketReturn = ReturnType<typeof useWebSocket>;
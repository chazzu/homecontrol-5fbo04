import { createContext, useContext, useEffect, useState, useCallback } from 'react'; // v18.0.0
import {
  WebSocketService,
  WebSocketConfig,
  WebSocketConnectionState,
  WebSocketMessage,
  WebSocketEventCallback,
  WebSocketServiceCall
} from '../services/websocket';

/**
 * Interface defining the shape of the WebSocket context value
 */
interface WebSocketContextValue {
  connectionState: WebSocketConnectionState;
  connectionMetrics: {
    latency: number;
    messagesSent: number;
    messagesReceived: number;
    errors: number;
    lastHealthCheck: number;
  };
  connect: (config: WebSocketConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  subscribe: (eventType: string, callback: WebSocketEventCallback) => () => void;
  callService: (serviceCall: WebSocketServiceCall) => Promise<void>;
  resetCircuitBreaker: () => void;
}

// Create context with null initial value
const WebSocketContext = createContext<WebSocketContextValue | null>(null);

/**
 * Props interface for the WebSocket provider component
 */
interface WebSocketProviderProps {
  children: React.ReactNode;
  initialConfig?: WebSocketConfig;
}

/**
 * WebSocket provider component that manages WebSocket connections and state
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  initialConfig
}) => {
  const [webSocketService] = useState(() => new WebSocketService(initialConfig || {
    url: '',
    token: '',
    reconnectInterval: 5000,
    maxRetries: 5
  }));

  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>(
    WebSocketConnectionState.DISCONNECTED
  );

  const [connectionMetrics, setConnectionMetrics] = useState({
    latency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    lastHealthCheck: 0
  });

  // Update connection metrics periodically
  useEffect(() => {
    const metricsInterval = setInterval(() => {
      const metrics = webSocketService.getConnectionMetrics();
      setConnectionMetrics(metrics);
      setConnectionState(webSocketService.getConnectionState());
    }, 1000);

    return () => clearInterval(metricsInterval);
  }, [webSocketService]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      webSocketService.disconnect();
    };
  }, [webSocketService]);

  const connect = useCallback(async (config: WebSocketConfig) => {
    try {
      await webSocketService.connect();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      throw error;
    }
  }, [webSocketService]);

  const disconnect = useCallback(async () => {
    try {
      await webSocketService.disconnect();
    } catch (error) {
      console.error('Failed to disconnect WebSocket:', error);
      throw error;
    }
  }, [webSocketService]);

  const subscribe = useCallback((
    eventType: string,
    callback: WebSocketEventCallback
  ) => {
    return webSocketService.subscribe(eventType, callback);
  }, [webSocketService]);

  const callService = useCallback(async (
    serviceCall: WebSocketServiceCall
  ) => {
    try {
      await webSocketService.callService(serviceCall);
    } catch (error) {
      console.error('Failed to call service:', error);
      throw error;
    }
  }, [webSocketService]);

  const resetCircuitBreaker = useCallback(() => {
    webSocketService.resetCircuitBreaker();
  }, [webSocketService]);

  const contextValue: WebSocketContextValue = {
    connectionState,
    connectionMetrics,
    connect,
    disconnect,
    subscribe,
    callService,
    resetCircuitBreaker
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Custom hook for accessing WebSocket context with type safety
 * @throws Error if used outside of WebSocketProvider
 */
export const useWebSocket = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;
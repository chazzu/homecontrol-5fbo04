import { createConnection, createLongLivedTokenAuth } from 'home-assistant-js-websocket'; // v8.0.1
import {
  WebSocketConfig,
  WebSocketConnectionState,
  WebSocketMessage,
  WebSocketEventCallback,
  WebSocketError,
  isWebSocketError,
  WebSocketSubscription,
  WebSocketServiceCall
} from '../types/websocket.types';

// Constants for WebSocket service configuration
const DEFAULT_MESSAGE_TIMEOUT = 10000;
const RETRY_BACKOFF_MULTIPLIER = 1.5;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const HEALTH_CHECK_INTERVAL = 30000;
const MAX_MESSAGE_SIZE = 1048576; // 1MB
const CONNECTION_POOL_SIZE = 3;

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  resetTimeout: number;
}

interface ConnectionMetrics {
  latency: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  lastHealthCheck: number;
}

interface MessageQueueItem {
  message: WebSocketMessage;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
}

/**
 * Advanced WebSocket service for managing secure communication with Home Assistant
 * Implements connection pooling, circuit breaker pattern, and comprehensive monitoring
 */
export class WebSocketService {
  private connectionPool: Map<string, WebSocket>;
  private config: WebSocketConfig;
  private connectionState: WebSocketConnectionState;
  private retryCount: number;
  private circuitBreaker: CircuitBreakerState;
  private eventSubscriptions: Map<string, Set<WebSocketEventCallback>>;
  private messageQueue: MessageQueueItem[];
  private metrics: ConnectionMetrics;
  private healthCheckInterval?: NodeJS.Timer;
  private messageIdCounter: number;

  constructor(config: WebSocketConfig) {
    this.config = {
      ...config,
      reconnectInterval: config.reconnectInterval || DEFAULT_MESSAGE_TIMEOUT,
      maxRetries: config.maxRetries || CIRCUIT_BREAKER_THRESHOLD
    };
    this.connectionPool = new Map();
    this.connectionState = WebSocketConnectionState.DISCONNECTED;
    this.retryCount = 0;
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      resetTimeout: this.config.reconnectInterval * RETRY_BACKOFF_MULTIPLIER
    };
    this.eventSubscriptions = new Map();
    this.messageQueue = [];
    this.messageIdCounter = 1;
    this.metrics = {
      latency: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      lastHealthCheck: Date.now()
    };
  }

  /**
   * Establishes secure WebSocket connections with connection pooling
   */
  public async connect(): Promise<void> {
    if (this.circuitBreaker.isOpen) {
      throw new Error('Circuit breaker is open. Connection not allowed.');
    }

    try {
      this.connectionState = WebSocketConnectionState.CONNECTING;
      const auth = createLongLivedTokenAuth(this.config.url, this.config.token);

      // Initialize connection pool
      for (let i = 0; i < CONNECTION_POOL_SIZE; i++) {
        const connection = await createConnection({ auth });
        const id = `conn_${i}`;
        this.connectionPool.set(id, connection as unknown as WebSocket);
        this.setupConnectionHandlers(id, connection as unknown as WebSocket);
      }

      this.connectionState = WebSocketConnectionState.CONNECTED;
      this.retryCount = 0;
      this.startHealthCheck();
      this.processMessageQueue();
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  /**
   * Safely closes all WebSocket connections
   */
  public async disconnect(): Promise<void> {
    this.stopHealthCheck();
    this.messageQueue = [];
    
    for (const [id, connection] of this.connectionPool) {
      this.removeConnectionHandlers(id, connection);
      connection.close();
    }
    
    this.connectionPool.clear();
    this.eventSubscriptions.clear();
    this.connectionState = WebSocketConnectionState.DISCONNECTED;
  }

  /**
   * Subscribes to Home Assistant events
   */
  public subscribe(eventType: string, callback: WebSocketEventCallback): () => void {
    if (!this.eventSubscriptions.has(eventType)) {
      this.eventSubscriptions.set(eventType, new Set());
    }
    
    const callbacks = this.eventSubscriptions.get(eventType)!;
    callbacks.add(callback);

    // Send subscription message through an available connection
    const message: WebSocketMessage = {
      type: 'subscribe_events',
      id: this.getNextMessageId(),
      payload: { event_type: eventType }
    };
    
    this.sendMessage(message).catch(error => {
      console.error('Failed to subscribe to event:', error);
    });

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.eventSubscriptions.delete(eventType);
      }
    };
  }

  /**
   * Sends message with guaranteed delivery and timeout handling
   */
  public async sendMessage(message: WebSocketMessage): Promise<any> {
    if (this.connectionState !== WebSocketConnectionState.CONNECTED) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      if (JSON.stringify(message).length > MAX_MESSAGE_SIZE) {
        reject(new Error('Message size exceeds maximum allowed size'));
        return;
      }

      const queueItem: MessageQueueItem = {
        message,
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.messageQueue.push(queueItem);
      this.processMessageQueue();
    });
  }

  /**
   * Calls a Home Assistant service
   */
  public async callService(serviceCall: WebSocketServiceCall): Promise<void> {
    const message: WebSocketMessage = {
      type: 'call_service',
      id: this.getNextMessageId(),
      payload: {
        domain: serviceCall.domain,
        service: serviceCall.service,
        service_data: serviceCall.serviceData,
        target: serviceCall.target
      }
    };

    return this.sendMessage(message);
  }

  /**
   * Returns current connection state
   */
  public getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  /**
   * Returns connection metrics
   */
  public getConnectionMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets the circuit breaker
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      resetTimeout: this.config.reconnectInterval * RETRY_BACKOFF_MULTIPLIER
    };
  }

  private setupConnectionHandlers(id: string, connection: WebSocket): void {
    connection.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    connection.onclose = () => this.handleConnectionClose(id);
    connection.onerror = (error) => this.handleConnectionError(error);
  }

  private removeConnectionHandlers(id: string, connection: WebSocket): void {
    connection.onmessage = null;
    connection.onclose = null;
    connection.onerror = null;
  }

  private handleMessage(message: WebSocketMessage): void {
    this.metrics.messagesReceived++;

    if (isWebSocketError(message)) {
      this.handleError(message.payload);
      return;
    }

    if (message.type === 'event') {
      const callbacks = this.eventSubscriptions.get(message.payload.event_type);
      callbacks?.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      });
    }
  }

  private handleConnectionError(error: any): void {
    this.metrics.errors++;
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      this.connectionState = WebSocketConnectionState.CIRCUIT_OPEN;
      setTimeout(() => this.resetCircuitBreaker(), this.circuitBreaker.resetTimeout);
    } else {
      this.attemptReconnection();
    }
  }

  private handleConnectionClose(id: string): void {
    this.connectionPool.delete(id);
    if (this.connectionPool.size === 0) {
      this.connectionState = WebSocketConnectionState.DISCONNECTED;
      this.attemptReconnection();
    }
  }

  private async attemptReconnection(): Promise<void> {
    if (this.retryCount >= this.config.maxRetries || this.circuitBreaker.isOpen) {
      return;
    }

    this.connectionState = WebSocketConnectionState.RECONNECTING;
    this.retryCount++;
    
    const backoffTime = this.config.reconnectInterval * 
      Math.pow(RETRY_BACKOFF_MULTIPLIER, this.retryCount - 1);
    
    await new Promise(resolve => setTimeout(resolve, backoffTime));
    this.connect().catch(error => {
      console.error('Reconnection attempt failed:', error);
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    try {
      await this.sendMessage({
        type: 'ping',
        id: this.getNextMessageId(),
        payload: null
      });
      this.metrics.latency = Date.now() - startTime;
      this.metrics.lastHealthCheck = Date.now();
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const item = this.messageQueue[0];
      const connection = this.getLeastLoadedConnection();
      
      if (!connection) {
        break;
      }

      if (Date.now() - item.timestamp > DEFAULT_MESSAGE_TIMEOUT) {
        item.reject(new Error('Message timeout'));
        this.messageQueue.shift();
        continue;
      }

      try {
        connection.send(JSON.stringify(item.message));
        this.metrics.messagesSent++;
        item.resolve(true);
        this.messageQueue.shift();
      } catch (error) {
        item.reject(error);
        this.messageQueue.shift();
      }
    }
  }

  private getLeastLoadedConnection(): WebSocket | undefined {
    let leastLoaded: WebSocket | undefined;
    let minBufferedAmount = Infinity;

    for (const connection of this.connectionPool.values()) {
      if (connection.bufferedAmount < minBufferedAmount) {
        minBufferedAmount = connection.bufferedAmount;
        leastLoaded = connection;
      }
    }

    return leastLoaded;
  }

  private handleError(error: WebSocketError): void {
    console.error('WebSocket error:', error);
    this.metrics.errors++;
  }

  private getNextMessageId(): number {
    return this.messageIdCounter++;
  }
}
/**
 * @file WebSocketService.ts
 * @version 1.0.0
 * 
 * Advanced WebSocket service implementing secure real-time communication with Home Assistant.
 * Features connection management, message batching, automatic reconnection, and performance monitoring.
 */

import WebSocket from 'ws'; // v8.0.0
import { IWebSocket } from '../interfaces/IWebSocket';
import { WebSocketConnectionState, WebSocketConfig, DEFAULT_RECONNECT_INTERVAL, MAX_RECONNECT_ATTEMPTS, MESSAGE_TIMEOUT } from '../types/WebSocket.types';
import { HAWebSocketMessage, HAEventType, isResultMessage, isAuthMessage } from '../../types/homeAssistant';

/**
 * Interface for tracking connection metrics
 */
interface ConnectionMetrics {
  latency: number;
  messagesSent: number;
  messagesReceived: number;
  lastMessageTimestamp: number;
  reconnections: number;
}

/**
 * Advanced WebSocket service implementation with enterprise-grade features
 */
export class WebSocketService implements IWebSocket {
  private ws: WebSocket | null = null;
  private connectionState: WebSocketConnectionState = WebSocketConnectionState.DISCONNECTED;
  private messageQueue: Map<number, {
    resolve: (response: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private eventSubscriptions: Map<number, {
    callback: (event: HAWebSocketMessage) => void;
    eventType: string;
  }> = new Map();
  private reconnectAttempts: number = 0;
  private messageId: number = 1;
  private batchQueue: Array<HAWebSocketMessage> = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private metrics: ConnectionMetrics = {
    latency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastMessageTimestamp: 0,
    reconnections: 0
  };

  constructor(private readonly config: WebSocketConfig) {
    // Validate configuration
    if (!config.url || !config.url.startsWith('wss://')) {
      throw new Error('WebSocket URL must use secure WSS protocol');
    }
    if (!config.authToken) {
      throw new Error('Authentication token is required');
    }
  }

  /**
   * Establishes WebSocket connection with automatic reconnection
   */
  public async connect(): Promise<void> {
    if (this.connectionState === WebSocketConnectionState.CONNECTING ||
        this.connectionState === WebSocketConnectionState.CONNECTED) {
      return;
    }

    this.connectionState = WebSocketConnectionState.CONNECTING;

    try {
      this.ws = new WebSocket(this.config.url, {
        rejectUnauthorized: true,
        handshakeTimeout: 5000,
        maxPayload: 5 * 1024 * 1024 // 5MB max payload
      });

      await this.setupWebSocketHandlers();
      await this.authenticate();
      
      this.connectionState = WebSocketConnectionState.CONNECTED;
      this.reconnectAttempts = 0;
      this.restoreSubscriptions();
    } catch (error) {
      await this.handleConnectionError(error as Error);
    }
  }

  /**
   * Gracefully disconnects WebSocket connection
   */
  public async disconnect(force: boolean = false): Promise<void> {
    if (!this.ws) return;

    this.connectionState = WebSocketConnectionState.DISCONNECTED;
    this.clearBatchQueue();
    
    if (force) {
      this.ws.terminate();
    } else {
      this.ws.close(1000, 'Normal closure');
    }

    this.ws = null;
  }

  /**
   * Sends message with batching and timeout handling
   */
  public async sendMessage(
    message: HAWebSocketMessage,
    options: { timeout?: number } = {}
  ): Promise<HAWebSocketMessage> {
    if (!this.ws || this.connectionState !== WebSocketConnectionState.CONNECTED) {
      throw new Error('WebSocket is not connected');
    }

    const id = this.messageId++;
    const enhancedMessage = { ...message, id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageQueue.delete(id);
        reject(new Error(`Message timeout after ${options.timeout || MESSAGE_TIMEOUT}ms`));
      }, options.timeout || MESSAGE_TIMEOUT);

      this.messageQueue.set(id, { resolve, reject, timeout });
      this.queueMessage(enhancedMessage);
    });
  }

  /**
   * Subscribes to Home Assistant events with automatic resubscription
   */
  public async subscribeToEvents(
    eventType: HAEventType,
    callback: (event: HAWebSocketMessage) => void
  ): Promise<number> {
    const subscriptionMessage: HAWebSocketMessage = {
      type: 'subscribe_events',
      event_type: eventType
    };

    const response = await this.sendMessage(subscriptionMessage);
    if (isResultMessage(response) && response.success) {
      const subscriptionId = response.id!;
      this.eventSubscriptions.set(subscriptionId, { callback, eventType });
      return subscriptionId;
    }

    throw new Error('Failed to subscribe to events');
  }

  /**
   * Unsubscribes from Home Assistant events
   */
  public async unsubscribeFromEvents(subscriptionId: number): Promise<void> {
    const unsubscribeMessage: HAWebSocketMessage = {
      type: 'unsubscribe_events',
      subscription: subscriptionId
    };

    await this.sendMessage(unsubscribeMessage);
    this.eventSubscriptions.delete(subscriptionId);
  }

  /**
   * Returns current connection state with diagnostics
   */
  public getConnectionState(): {
    state: WebSocketConnectionState;
    metrics: ConnectionMetrics;
  } {
    return {
      state: this.connectionState,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Sets up WebSocket event handlers
   */
  private async setupWebSocketHandlers(): Promise<void> {
    if (!this.ws) return;

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as HAWebSocketMessage;
        this.handleIncomingMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    this.ws.on('close', (code: number, reason: string) => {
      this.handleDisconnection(code, reason);
    });

    this.ws.on('error', (error: Error) => {
      this.handleConnectionError(error);
    });

    this.ws.on('ping', () => {
      this.ws?.pong();
      this.updateLatency();
    });
  }

  /**
   * Handles authentication with Home Assistant
   */
  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const authTimeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 5000);

      this.ws?.once('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (isAuthMessage(message)) {
            this.ws?.send(JSON.stringify({
              type: 'auth',
              access_token: this.config.authToken
            }));
          }
        } catch (error) {
          clearTimeout(authTimeout);
          reject(error);
        }
      });

      this.ws?.once('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_ok') {
            clearTimeout(authTimeout);
            resolve();
          } else if (message.type === 'auth_invalid') {
            clearTimeout(authTimeout);
            reject(new Error('Authentication failed'));
          }
        } catch (error) {
          clearTimeout(authTimeout);
          reject(error);
        }
      });
    });
  }

  /**
   * Handles incoming WebSocket messages
   */
  private handleIncomingMessage(message: HAWebSocketMessage): void {
    this.metrics.messagesReceived++;
    this.metrics.lastMessageTimestamp = Date.now();

    if (isResultMessage(message) && message.id) {
      const pending = this.messageQueue.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.messageQueue.delete(message.id);
        if (message.success) {
          pending.resolve(message);
        } else {
          pending.reject(new Error(message.error?.message || 'Unknown error'));
        }
      }
    } else if (message.type === 'event') {
      this.handleEventMessage(message);
    }
  }

  /**
   * Handles event messages from Home Assistant
   */
  private handleEventMessage(message: HAWebSocketMessage): void {
    this.eventSubscriptions.forEach((subscription) => {
      if (subscription.eventType === message.event_type) {
        subscription.callback(message);
      }
    });
  }

  /**
   * Handles WebSocket disconnection
   */
  private async handleDisconnection(code: number, reason: string): Promise<void> {
    this.connectionState = WebSocketConnectionState.DISCONNECTED;
    console.warn(`WebSocket disconnected: ${code} - ${reason}`);

    if (this.reconnectAttempts < (this.config.maxReconnectAttempts || MAX_RECONNECT_ATTEMPTS)) {
      await this.reconnect();
    }
  }

  /**
   * Handles WebSocket connection errors
   */
  private async handleConnectionError(error: Error): Promise<void> {
    console.error('WebSocket error:', error);
    this.connectionState = WebSocketConnectionState.DISCONNECTED;

    if (this.reconnectAttempts < (this.config.maxReconnectAttempts || MAX_RECONNECT_ATTEMPTS)) {
      await this.reconnect();
    }
  }

  /**
   * Implements reconnection with exponential backoff
   */
  private async reconnect(): Promise<void> {
    this.connectionState = WebSocketConnectionState.RECONNECTING;
    this.reconnectAttempts++;
    this.metrics.reconnections++;

    const backoffTime = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.config.reconnectInterval || DEFAULT_RECONNECT_INTERVAL
    );

    await new Promise(resolve => setTimeout(resolve, backoffTime));
    await this.connect();
  }

  /**
   * Restores event subscriptions after reconnection
   */
  private async restoreSubscriptions(): Promise<void> {
    const subscriptions = new Map(this.eventSubscriptions);
    this.eventSubscriptions.clear();

    for (const [id, subscription] of subscriptions) {
      try {
        await this.subscribeToEvents(
          subscription.eventType as HAEventType,
          subscription.callback
        );
      } catch (error) {
        console.error(`Failed to restore subscription ${id}:`, error);
      }
    }
  }

  /**
   * Implements message batching for performance optimization
   */
  private queueMessage(message: HAWebSocketMessage): void {
    this.batchQueue.push(message);
    this.metrics.messagesSent++;

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flushBatchQueue(), 100);
    }

    if (this.batchQueue.length >= 10) {
      this.flushBatchQueue();
    }
  }

  /**
   * Flushes batch queue and sends messages
   */
  private flushBatchQueue(): void {
    if (!this.ws || this.batchQueue.length === 0) return;

    const batch = this.batchQueue;
    this.batchQueue = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    batch.forEach(message => {
      this.ws?.send(JSON.stringify(message));
    });
  }

  /**
   * Clears batch queue and pending messages
   */
  private clearBatchQueue(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    this.batchQueue = [];
    this.messageQueue.forEach(({ timeout }) => clearTimeout(timeout));
    this.messageQueue.clear();
  }

  /**
   * Updates connection latency metrics
   */
  private updateLatency(): void {
    const now = Date.now();
    this.metrics.latency = now - this.metrics.lastMessageTimestamp;
  }
}
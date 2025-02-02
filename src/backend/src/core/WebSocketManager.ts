/**
 * @file WebSocketManager.ts
 * @version 1.0.0
 * 
 * Enhanced WebSocket manager implementing secure real-time communication with Home Assistant.
 * Features connection management, message batching, automatic reconnection, and performance monitoring.
 */

import { injectable, singleton } from 'inversify'; // v6.0.1
import { IWebSocket } from './interfaces/IWebSocket';
import { WebSocketService } from './services/WebSocketService';
import { WebSocketConfig } from '../config/websocket';
import { 
  WebSocketConnectionState, 
  WebSocketMessageOptions 
} from './types/WebSocket.types';
import { 
  HAWebSocketMessage, 
  HAEventType 
} from '../types/homeAssistant';

/**
 * Queue implementation for message batching
 */
class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  get length(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}

/**
 * Connection metrics tracking
 */
interface ConnectionMetrics {
  latency: number;
  messagesSent: number;
  messagesReceived: number;
  lastMessageTimestamp: number;
  reconnections: number;
  uptime: number;
  connectionStartTime: number;
}

/**
 * Rate limiter implementation
 */
class RateLimiter {
  private timestamps: number[] = [];
  
  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number
  ) {}

  canMakeRequest(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return this.timestamps.length < this.maxRequests;
  }

  recordRequest(): void {
    this.timestamps.push(Date.now());
  }
}

/**
 * Exponential backoff implementation
 */
class ExponentialBackoff {
  private attempt: number = 0;

  constructor(
    private readonly baseDelay: number,
    private readonly maxDelay: number
  ) {}

  getDelay(): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt),
      this.maxDelay
    );
    this.attempt++;
    return delay;
  }

  reset(): void {
    this.attempt = 0;
  }
}

/**
 * Enhanced WebSocket manager with improved error handling and performance optimizations
 */
@injectable()
@singleton()
export class WebSocketManager implements IWebSocket {
  private webSocketService: WebSocketService;
  private connectionPromise: Promise<void> | null = null;
  private eventSubscriptions = new Map<number, (event: any) => void>();
  private messageQueue = new Queue<HAWebSocketMessage>();
  private connectionMetrics: ConnectionMetrics = {
    latency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastMessageTimestamp: 0,
    reconnections: 0,
    uptime: 0,
    connectionStartTime: 0
  };
  private rateLimiter: RateLimiter;
  private retryBackoff: ExponentialBackoff;

  constructor(
    webSocketService: WebSocketService,
    private readonly config: WebSocketConfig
  ) {
    this.webSocketService = webSocketService;
    this.rateLimiter = new RateLimiter(60000, this.config.rateLimit);
    this.retryBackoff = new ExponentialBackoff(1000, this.config.reconnectInterval);
  }

  /**
   * Establishes WebSocket connection with enhanced error handling
   */
  public async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        const backoffDelay = this.retryBackoff.getDelay();
        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        await this.webSocketService.connect();
        this.connectionMetrics.connectionStartTime = Date.now();
        this.startMetricsTracking();
        this.retryBackoff.reset();
        resolve();
      } catch (error) {
        this.connectionPromise = null;
        this.connectionMetrics.reconnections++;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Gracefully disconnects WebSocket connection
   */
  public async disconnect(force: boolean = false): Promise<void> {
    this.stopMetricsTracking();
    await this.webSocketService.disconnect(force);
    this.connectionPromise = null;
  }

  /**
   * Sends message with batching and rate limiting
   */
  public async sendMessage(
    message: HAWebSocketMessage,
    options: WebSocketMessageOptions = {}
  ): Promise<HAWebSocketMessage> {
    if (!this.rateLimiter.canMakeRequest()) {
      throw new Error('Rate limit exceeded');
    }

    this.rateLimiter.recordRequest();
    this.messageQueue.enqueue(message);
    this.connectionMetrics.messagesSent++;

    return this.webSocketService.sendMessage(message, {
      timeout: options.timeout || this.config.messageTimeout
    });
  }

  /**
   * Subscribes to Home Assistant events
   */
  public async subscribeToEvents(
    eventType: HAEventType,
    callback: (event: HAWebSocketMessage) => void,
    options?: { persistent?: boolean }
  ): Promise<number> {
    const subscriptionId = await this.webSocketService.subscribeToEvents(
      eventType,
      callback
    );
    this.eventSubscriptions.set(subscriptionId, callback);
    return subscriptionId;
  }

  /**
   * Unsubscribes from Home Assistant events
   */
  public async unsubscribeFromEvents(subscriptionId: number): Promise<void> {
    await this.webSocketService.unsubscribeFromEvents(subscriptionId);
    this.eventSubscriptions.delete(subscriptionId);
  }

  /**
   * Returns current connection state with metrics
   */
  public getConnectionState(): {
    state: WebSocketConnectionState;
    metrics: ConnectionMetrics;
  } {
    const { state, metrics: serviceMetrics } = this.webSocketService.getConnectionState();
    
    return {
      state,
      metrics: {
        ...this.connectionMetrics,
        latency: serviceMetrics.latency,
        uptime: this.calculateUptime()
      }
    };
  }

  /**
   * Starts tracking connection metrics
   */
  private startMetricsTracking(): void {
    setInterval(() => {
      this.connectionMetrics.uptime = this.calculateUptime();
    }, 1000);
  }

  /**
   * Stops tracking connection metrics
   */
  private stopMetricsTracking(): void {
    this.connectionMetrics = {
      latency: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastMessageTimestamp: 0,
      reconnections: 0,
      uptime: 0,
      connectionStartTime: 0
    };
  }

  /**
   * Calculates connection uptime in seconds
   */
  private calculateUptime(): number {
    if (!this.connectionMetrics.connectionStartTime) {
      return 0;
    }
    return Math.floor(
      (Date.now() - this.connectionMetrics.connectionStartTime) / 1000
    );
  }
}
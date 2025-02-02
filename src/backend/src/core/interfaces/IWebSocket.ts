/**
 * @file IWebSocket.ts
 * @version 1.0.0
 * 
 * Core interface defining the contract for WebSocket communication with Home Assistant.
 * Implements real-time communication with < 200ms latency requirement and connection pooling.
 */

import { HAWebSocketMessage, HAEventType } from '../../types/homeAssistant';
import { WebSocketConnectionState } from '../types/WebSocket.types';

/**
 * Options for establishing WebSocket connection
 */
interface ConnectionOptions {
  /** Maximum time to wait for connection in milliseconds */
  timeout?: number;
  /** Whether to automatically reconnect on failure */
  autoReconnect?: boolean;
  /** Custom reconnection strategy configuration */
  reconnectStrategy?: {
    maxAttempts: number;
    intervalMs: number;
  };
}

/**
 * Options for sending messages over WebSocket
 */
interface MessageOptions {
  /** Message timeout in milliseconds */
  timeout?: number;
  /** Retry configuration for failed messages */
  retry?: {
    maxAttempts: number;
    intervalMs: number;
  };
  /** Priority level for message queue */
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Options for event subscriptions
 */
interface SubscriptionOptions {
  /** Whether subscription should persist across reconnects */
  persistent?: boolean;
  /** Subscription timeout in milliseconds */
  timeout?: number;
  /** Custom event filtering criteria */
  filter?: Record<string, unknown>;
}

/**
 * Connection state with diagnostic information
 */
interface ConnectionState {
  /** Current connection state */
  state: WebSocketConnectionState;
  /** Last connection attempt timestamp */
  lastAttempt?: Date;
  /** Connection latency in milliseconds */
  latency?: number;
  /** Number of reconnection attempts */
  reconnectAttempts?: number;
  /** Detailed error information if disconnected */
  error?: {
    code: string;
    message: string;
    timestamp: Date;
  };
}

/**
 * Core interface for WebSocket communication with Home Assistant
 * Provides contract for connection management, message handling, and event subscriptions
 */
export interface IWebSocket {
  /**
   * Establishes WebSocket connection with Home Assistant
   * 
   * @param options - Connection configuration options
   * @returns Promise that resolves when connection is established
   * @throws Error if connection fails or times out
   */
  connect(options?: ConnectionOptions): Promise<void>;

  /**
   * Gracefully closes WebSocket connection
   * 
   * @param force - Whether to force immediate closure
   * @returns Promise that resolves when connection is closed
   */
  disconnect(force?: boolean): Promise<void>;

  /**
   * Sends a message to Home Assistant with timeout and retry handling
   * 
   * @param message - Message to send
   * @param options - Message sending options
   * @returns Promise that resolves with the response
   * @throws Error if send fails or times out
   */
  sendMessage(
    message: HAWebSocketMessage,
    options?: MessageOptions
  ): Promise<HAWebSocketMessage>;

  /**
   * Subscribes to Home Assistant events with automatic resubscription
   * 
   * @param eventType - Type of event to subscribe to
   * @param callback - Function to handle received events
   * @param options - Subscription options
   * @returns Promise that resolves with subscription ID
   * @throws Error if subscription fails
   */
  subscribeToEvents(
    eventType: HAEventType,
    callback: (event: HAWebSocketMessage) => void,
    options?: SubscriptionOptions
  ): Promise<number>;

  /**
   * Unsubscribes from Home Assistant events
   * 
   * @param subscriptionId - ID of subscription to cancel
   * @returns Promise that resolves when unsubscribed
   * @throws Error if unsubscribe fails
   */
  unsubscribeFromEvents(subscriptionId: number): Promise<void>;

  /**
   * Returns current WebSocket connection state with diagnostics
   * 
   * @returns Current connection state and diagnostic information
   */
  getConnectionState(): ConnectionState;
}
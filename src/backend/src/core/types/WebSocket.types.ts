/**
 * @file WebSocket.types.ts
 * @version 1.0.0
 * 
 * Type definitions for WebSocket communication with Home Assistant.
 * Includes connection states, configuration, event handling, and message queue management.
 */

import { HAWebSocketMessage } from '../../types/homeAssistant';

/**
 * Default configuration values for WebSocket connection management
 */
export const DEFAULT_RECONNECT_INTERVAL = 5000; // 5 seconds
export const MAX_RECONNECT_ATTEMPTS = 5;
export const MESSAGE_TIMEOUT = 10000; // 10 seconds

/**
 * Enumeration of possible WebSocket connection states
 * Used for tracking and managing connection lifecycle
 */
export enum WebSocketConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting'
}

/**
 * Configuration interface for WebSocket connection
 * Defines required parameters for establishing and maintaining connection
 */
export interface WebSocketConfig {
  /**
   * WebSocket server URL (e.g., 'wss://homeassistant.local:8123/api/websocket')
   */
  url: string;

  /**
   * Authentication token for Home Assistant
   * Must be a valid long-lived access token
   */
  authToken: string;

  /**
   * Interval between reconnection attempts in milliseconds
   * @default DEFAULT_RECONNECT_INTERVAL
   */
  reconnectInterval: number;

  /**
   * Maximum number of reconnection attempts before giving up
   * @default MAX_RECONNECT_ATTEMPTS
   */
  maxReconnectAttempts: number;
}

/**
 * Type definition for WebSocket event callback functions
 * Used for handling incoming messages and events from Home Assistant
 */
export type WebSocketEventCallback = (event: HAWebSocketMessage) => void;

/**
 * Type definition for managing pending WebSocket messages
 * Maps message IDs to their corresponding response handlers
 * 
 * @example
 * const messageQueue: WebSocketMessageQueue = new Map();
 * messageQueue.set(1, (response) => console.log('Response received:', response));
 */
export type WebSocketMessageQueue = Map<number, (response: any) => void>;

/**
 * Type guard to check if a connection state is valid
 * @param state - The state to check
 */
export function isValidConnectionState(state: string): state is WebSocketConnectionState {
  return Object.values(WebSocketConnectionState).includes(state as WebSocketConnectionState);
}

/**
 * Type definition for WebSocket connection error handling
 */
export interface WebSocketError extends Error {
  code?: string;
  reason?: string;
  wasClean?: boolean;
}

/**
 * Type definition for WebSocket message handling options
 */
export interface WebSocketMessageOptions {
  /**
   * Timeout duration in milliseconds
   * @default MESSAGE_TIMEOUT
   */
  timeout?: number;

  /**
   * Whether to automatically retry failed messages
   * @default false
   */
  retry?: boolean;

  /**
   * Maximum number of retry attempts for failed messages
   * @default 3
   */
  maxRetries?: number;
}

/**
 * Type definition for WebSocket subscription management
 */
export interface WebSocketSubscription {
  /**
   * Unique subscription identifier
   */
  id: number;

  /**
   * Event type being subscribed to
   */
  eventType: string;

  /**
   * Callback function for handling subscription events
   */
  callback: WebSocketEventCallback;

  /**
   * Optional subscription options
   */
  options?: {
    /**
     * Whether to maintain subscription across reconnects
     * @default true
     */
    persistent?: boolean;
  };
}
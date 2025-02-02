/**
 * @file WebSocket Configuration for Home Assistant Communication
 * @version 1.0.0
 * 
 * Defines comprehensive WebSocket configuration settings and constants for secure,
 * reliable communication with Home Assistant, including connection management,
 * message validation, and performance monitoring.
 */

import { config } from 'dotenv'; // v16.0.0
import { ENV } from './constants';
import { HAMessageType, HAEventType } from '../types/homeAssistant';

// Initialize environment variables
config();

/**
 * Default WebSocket connection URL based on environment
 * Uses secure WebSocket (WSS) in production
 */
export const DEFAULT_WS_URL = process.env.WS_URL || 
  (ENV.IS_PRODUCTION ? 'wss://localhost:8123/api/websocket' : 'ws://localhost:8123/api/websocket');

// Connection management defaults
export const DEFAULT_RECONNECT_INTERVAL = 5000; // 5 seconds
export const DEFAULT_MAX_RETRIES = 5;
export const DEFAULT_PING_INTERVAL = 30000; // 30 seconds
export const DEFAULT_MESSAGE_TIMEOUT = 10000; // 10 seconds

// Performance optimization defaults
export const DEFAULT_BATCH_INTERVAL = 100; // 100ms for message batching
export const DEFAULT_MAX_BATCH_SIZE = 50; // Maximum messages per batch
export const DEFAULT_RATE_LIMIT = 100; // Requests per minute

/**
 * Comprehensive WebSocket configuration interface
 */
interface WebSocketConfigInterface {
  /** WebSocket connection URL */
  url: string;
  /** Reconnection interval in milliseconds */
  reconnectInterval: number;
  /** Maximum reconnection attempts */
  maxRetries: number;
  /** Keep-alive ping interval in milliseconds */
  pingInterval: number;
  /** Message timeout duration in milliseconds */
  messageTimeout: number;
  /** Message batching interval in milliseconds */
  batchInterval: number;
  /** Maximum messages per batch */
  maxBatchSize: number;
  /** Rate limit for requests per minute */
  rateLimit: number;
}

/**
 * WebSocket configuration with production-ready defaults
 */
export const WebSocketConfig: Readonly<WebSocketConfigInterface> = {
  url: DEFAULT_WS_URL,
  reconnectInterval: Number(process.env.WS_RECONNECT_INTERVAL) || DEFAULT_RECONNECT_INTERVAL,
  maxRetries: Number(process.env.WS_MAX_RETRIES) || DEFAULT_MAX_RETRIES,
  pingInterval: Number(process.env.WS_PING_INTERVAL) || DEFAULT_PING_INTERVAL,
  messageTimeout: Number(process.env.WS_MESSAGE_TIMEOUT) || DEFAULT_MESSAGE_TIMEOUT,
  batchInterval: Number(process.env.WS_BATCH_INTERVAL) || DEFAULT_BATCH_INTERVAL,
  maxBatchSize: Number(process.env.WS_MAX_BATCH_SIZE) || DEFAULT_MAX_BATCH_SIZE,
  rateLimit: Number(process.env.WS_RATE_LIMIT) || DEFAULT_RATE_LIMIT
};

/**
 * WebSocket message type constants for Home Assistant communication
 */
export const WebSocketMessageTypes = {
  // Authentication messages
  AUTH: 'auth' as HAMessageType,
  AUTH_REQUIRED: 'auth_required' as HAMessageType,
  AUTH_OK: 'auth_ok' as HAMessageType,
  AUTH_INVALID: 'auth_invalid' as HAMessageType,

  // Event subscription messages
  SUBSCRIBE_EVENTS: 'subscribe_events' as HAMessageType,
  UNSUBSCRIBE_EVENTS: 'unsubscribe_events' as HAMessageType,

  // Trigger subscription messages
  SUBSCRIBE_TRIGGER: 'subscribe_trigger' as HAMessageType,
  UNSUBSCRIBE_TRIGGER: 'unsubscribe_trigger' as HAMessageType,

  // Service control messages
  CALL_SERVICE: 'call_service' as HAMessageType
} as const;

/**
 * WebSocket event type constants for monitoring and logging
 */
export const WebSocketEventTypes = {
  // Connection events
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  
  // Message events
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_ERROR: 'message_error',
  
  // Error events
  CONNECTION_ERROR: 'connection_error',
  AUTHENTICATION_ERROR: 'authentication_error',
  TIMEOUT_ERROR: 'timeout_error'
} as const;

/**
 * Retrieves WebSocket configuration with intelligent defaults
 * @returns Complete WebSocket configuration object
 */
export function getWebSocketConfig(): WebSocketConfigInterface {
  return {
    ...WebSocketConfig,
    // Override with any runtime-specific adjustments
    url: process.env.WS_URL || WebSocketConfig.url,
    // Ensure secure WebSocket in production
    ...(ENV.IS_PRODUCTION && {
      url: WebSocketConfig.url.replace('ws://', 'wss://')
    })
  };
}

// Freeze all exported objects to prevent runtime modifications
Object.freeze(WebSocketConfig);
Object.freeze(WebSocketMessageTypes);
Object.freeze(WebSocketEventTypes);
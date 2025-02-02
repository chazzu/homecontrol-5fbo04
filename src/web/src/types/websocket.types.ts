// home-assistant-js-websocket v8.0.1
import { HassConfig } from 'home-assistant-js-websocket';

/**
 * Enumeration of all possible WebSocket connection states
 * Used for comprehensive connection state management
 */
export enum WebSocketConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * Union type of all possible WebSocket message types
 * Ensures type safety for message handling
 */
export type WebSocketMessageType = 
  | 'auth'
  | 'auth_required'
  | 'auth_ok'
  | 'result'
  | 'subscribe_events'
  | 'unsubscribe_events'
  | 'call_service'
  | 'event';

/**
 * Configuration options for WebSocket connection
 * Includes connection management parameters
 */
export interface WebSocketConfig {
  /** WebSocket server URL */
  url: string;
  /** Authentication token for Home Assistant */
  token: string;
  /** Interval between reconnection attempts in milliseconds */
  reconnectInterval: number;
  /** Maximum number of reconnection attempts */
  maxRetries: number;
}

/**
 * Structure for WebSocket messages
 * Provides comprehensive type safety for message handling
 */
export interface WebSocketMessage {
  /** Type of the WebSocket message */
  type: WebSocketMessageType;
  /** Unique message identifier */
  id: number;
  /** Message payload - type varies based on message type */
  payload: any;
}

/**
 * Callback type for WebSocket event handling
 * Supports both synchronous and asynchronous handlers
 */
export type WebSocketEventCallback = (
  event: WebSocketMessage
) => Promise<void> | void;

/**
 * Comprehensive structure for WebSocket errors
 * Includes detailed error information for debugging
 */
export interface WebSocketError {
  /** Error code for categorization */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details as key-value pairs */
  details: Record<string, unknown>;
}

/**
 * Default configuration values for WebSocket connection
 */
export const WS_DEFAULT_RECONNECT_INTERVAL = 5000;
export const WS_MAX_RETRIES = 5;
export const WS_MESSAGE_TIMEOUT = 10000;

/**
 * Extended Home Assistant configuration including WebSocket specific fields
 */
export interface ExtendedHassConfig extends HassConfig {
  /** WebSocket connection configuration */
  websocket: WebSocketConfig;
}

/**
 * Type guard to check if a message is an error response
 */
export function isWebSocketError(
  message: WebSocketMessage
): message is WebSocketMessage & { payload: WebSocketError } {
  return message.type === 'result' && !!(message.payload as WebSocketError).code;
}

/**
 * Type for subscription message handling
 */
export interface WebSocketSubscription {
  /** Subscription identifier */
  id: number;
  /** Type of events to subscribe to */
  eventType: string;
  /** Callback for handling subscription events */
  callback: WebSocketEventCallback;
}

/**
 * Type for service call messages
 */
export interface WebSocketServiceCall {
  /** Domain of the service */
  domain: string;
  /** Service to call */
  service: string;
  /** Service call parameters */
  serviceData?: Record<string, unknown>;
  /** Target entities for the service call */
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };
}
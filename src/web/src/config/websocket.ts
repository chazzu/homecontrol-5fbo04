/**
 * WebSocket Configuration Module
 * Version: 1.0.0
 * 
 * Provides configuration constants and settings for Home Assistant WebSocket communication
 * Implements secure connection handling, message types, and error management
 * Optimized for < 200ms latency requirement per technical specifications
 */

import { WebSocketConfig } from '../types/websocket.types';
import { HassConfig } from 'home-assistant-js-websocket'; // v8.0.1

/**
 * Default WebSocket configuration with optimized settings for performance and reliability
 * Implements connection pooling and retry mechanisms as specified in technical requirements
 */
export const DEFAULT_WEBSOCKET_CONFIG: WebSocketConfig = {
  url: getWebSocketUrl(),
  reconnectInterval: 5000, // 5 seconds between retry attempts
  maxRetries: 5, // Maximum retry attempts before failure
  token: '', // Token to be injected at runtime
  messageTimeout: 10000, // 10 second timeout for messages
};

/**
 * WebSocket event types for state and service management
 * Aligned with Home Assistant WebSocket API specifications
 */
export const WEBSOCKET_EVENTS = {
  STATE_CHANGED: 'state_changed',
  SERVICE_REGISTERED: 'service_registered',
  SERVICE_EXECUTED: 'service_executed',
  DEVICE_REGISTERED: 'device_registered',
  DEVICE_REMOVED: 'device_removed',
  AREA_REGISTRY_UPDATED: 'area_registry_updated',
} as const;

/**
 * WebSocket message types for communication protocol
 * Comprehensive set of supported message types for HA interaction
 */
export const WEBSOCKET_MESSAGE_TYPES = {
  AUTH_REQUIRED: 'auth_required',
  AUTH: 'auth',
  AUTH_OK: 'auth_ok',
  AUTH_INVALID: 'auth_invalid',
  SUBSCRIBE_EVENTS: 'subscribe_events',
  UNSUBSCRIBE_EVENTS: 'unsubscribe_events',
  SUBSCRIBE_TRIGGER: 'subscribe_trigger',
  UNSUBSCRIBE_TRIGGER: 'unsubscribe_trigger',
  CALL_SERVICE: 'call_service',
  GET_STATES: 'get_states',
  GET_CONFIG: 'get_config',
  GET_SERVICES: 'get_services',
  GET_PANELS: 'get_panels',
  PING: 'ping',
  PONG: 'pong',
} as const;

/**
 * WebSocket error codes for error handling and recovery
 * Mapped to specific error scenarios for precise error management
 */
export const WEBSOCKET_ERROR_CODES = {
  INVALID_AUTH: 'invalid_auth',
  ID_REUSE: 'id_reuse',
  CANNOT_CONNECT: 'cannot_connect',
  CONNECTION_LOST: 'connection_lost',
  CONNECTION_TIMEOUT: 'connection_timeout',
  UNKNOWN: 'unknown',
} as const;

/**
 * Connection health check configuration
 * Implements monitoring for connection stability
 */
export const CONNECTION_HEALTH_CONFIG = {
  PING_INTERVAL: 30000, // 30 second ping interval
  PONG_TIMEOUT: 5000, // 5 second timeout for pong response
  HEALTH_CHECK_INTERVAL: 60000, // 1 minute health check interval
} as const;

/**
 * Generates secure WebSocket URL based on current protocol and host
 * Ensures secure connection handling based on protocol requirements
 */
function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const host = window.location.host;
  return `${protocol}${host}/api/websocket`;
}

/**
 * Retry strategy configuration for connection management
 * Implements exponential backoff for connection retries
 */
export const RETRY_STRATEGY = {
  INITIAL_DELAY: 1000, // 1 second initial delay
  MAX_DELAY: 30000, // 30 second maximum delay
  BACKOFF_FACTOR: 1.5, // Exponential backoff multiplier
  JITTER_FACTOR: 0.1, // 10% random jitter
} as const;

/**
 * Performance optimization settings
 * Configured for < 200ms latency requirement
 */
export const PERFORMANCE_CONFIG = {
  MESSAGE_BUFFER_SIZE: 100, // Maximum buffered messages
  BATCH_INTERVAL: 50, // 50ms batching interval
  STATE_SYNC_INTERVAL: 100, // 100ms state sync interval
  DEBOUNCE_INTERVAL: 150, // 150ms debounce for rapid updates
} as const;

/**
 * Message queue configuration for reliable delivery
 * Implements message persistence and retry logic
 */
export const MESSAGE_QUEUE_CONFIG = {
  MAX_QUEUE_SIZE: 1000, // Maximum queued messages
  RETRY_ATTEMPTS: 3, // Retry attempts for failed messages
  QUEUE_TIMEOUT: 5000, // 5 second queue timeout
} as const;
/**
 * @file Home Assistant WebSocket API Type Definitions
 * @version 1.0.0
 * 
 * Comprehensive TypeScript type definitions for Home Assistant WebSocket API communication.
 * Includes message formats, entity states, authentication flows, and service calls with 
 * strict type checking and extensive documentation.
 */

/**
 * Union type of all possible Home Assistant WebSocket message types
 */
export type HAMessageType = 
  | 'auth'
  | 'auth_required'
  | 'auth_ok'
  | 'auth_invalid'
  | 'result'
  | 'subscribe_events'
  | 'unsubscribe_events'
  | 'call_service'
  | 'get_states'
  | 'get_config';

/**
 * Union type of all possible Home Assistant event types
 */
export type HAEventType =
  | 'state_changed'
  | 'service_registered'
  | 'service_executed'
  | 'automation_triggered'
  | 'script_started'
  | 'device_registered'
  | 'platform_discovered';

/**
 * Union type of all supported Home Assistant entity domains
 */
export type HAEntityDomain =
  | 'light'
  | 'switch'
  | 'climate'
  | 'media_player'
  | 'sensor'
  | 'binary_sensor'
  | 'camera'
  | 'cover'
  | 'fan'
  | 'group'
  | 'automation'
  | 'script'
  | 'scene'
  | 'weather';

/**
 * Base interface for all Home Assistant WebSocket messages
 */
export interface HAWebSocketMessage {
  /** Message type identifier */
  type: HAMessageType;
  /** Message ID for request-response correlation */
  id?: number;
  /** Message payload - type varies by message type */
  payload?: unknown;
}

/**
 * Authentication message structure for Home Assistant WebSocket connection
 */
export interface HAAuthMessage extends HAWebSocketMessage {
  type: 'auth';
  /** Long-lived access token for authentication */
  access_token: string;
  /** Optional token expiration timestamp */
  expires_at: string | null;
}

/**
 * Service target specification for Home Assistant service calls
 */
export interface HAServiceTarget {
  /** List of entity IDs to target */
  entity_id?: string | string[];
  /** List of device IDs to target */
  device_id?: string | string[];
  /** List of area IDs to target */
  area_id?: string | string[];
}

/**
 * Service call message structure for Home Assistant
 */
export interface HAServiceCallMessage extends HAWebSocketMessage {
  type: 'call_service';
  /** Service domain (e.g., 'light', 'switch') */
  domain: HAEntityDomain;
  /** Service name (e.g., 'turn_on', 'turn_off') */
  service: string;
  /** Service call target specification */
  target?: HAServiceTarget;
  /** Service-specific parameters */
  service_data?: Record<string, unknown>;
}

/**
 * Context information for state changes and events
 */
export interface HAStateContext {
  /** Unique context identifier */
  id: string;
  /** Optional parent context identifier */
  parent_id: string | null;
  /** Associated user identifier */
  user_id: string | null;
}

/**
 * Comprehensive entity state interface
 */
export interface HAEntityState {
  /** Unique entity identifier (format: domain.name) */
  entity_id: string;
  /** Current state value */
  state: string;
  /** Entity-specific attributes */
  attributes: Record<string, unknown>;
  /** State change context information */
  context: HAStateContext;
  /** Timestamp of last state change */
  last_changed: string;
  /** Timestamp of last update */
  last_updated: string;
}

/**
 * Event message structure for Home Assistant
 */
export interface HAEventMessage extends HAWebSocketMessage {
  type: 'event';
  /** Event type identifier */
  event_type: HAEventType;
  /** Event data payload */
  event_data?: Record<string, unknown>;
  /** Event origin (internal, external) */
  origin: 'local' | 'remote';
  /** Event timestamp */
  time_fired: string;
  /** Event context information */
  context: HAStateContext;
}

/**
 * Result message structure for Home Assistant
 */
export interface HAResultMessage extends HAWebSocketMessage {
  type: 'result';
  /** Correlation ID matching the request */
  id: number;
  /** Success indicator */
  success: boolean;
  /** Result payload for successful operations */
  result?: unknown;
  /** Error information for failed operations */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Readonly record of all message types for runtime type checking
 */
export const HA_MESSAGE_TYPES: Readonly<Record<string, HAMessageType>> = {
  AUTH: 'auth',
  AUTH_REQUIRED: 'auth_required',
  AUTH_OK: 'auth_ok',
  AUTH_INVALID: 'auth_invalid',
  RESULT: 'result',
  SUBSCRIBE_EVENTS: 'subscribe_events',
  UNSUBSCRIBE_EVENTS: 'unsubscribe_events',
  CALL_SERVICE: 'call_service',
  GET_STATES: 'get_states',
  GET_CONFIG: 'get_config'
} as const;

/**
 * Readonly record of all event types for runtime type checking
 */
export const HA_EVENT_TYPES: Readonly<Record<string, HAEventType>> = {
  STATE_CHANGED: 'state_changed',
  SERVICE_REGISTERED: 'service_registered',
  SERVICE_EXECUTED: 'service_executed',
  AUTOMATION_TRIGGERED: 'automation_triggered',
  SCRIPT_STARTED: 'script_started',
  DEVICE_REGISTERED: 'device_registered',
  PLATFORM_DISCOVERED: 'platform_discovered'
} as const;

/**
 * Readonly record of all entity domains for runtime type checking
 */
export const HA_DOMAINS: Readonly<Record<string, HAEntityDomain>> = {
  LIGHT: 'light',
  SWITCH: 'switch',
  CLIMATE: 'climate',
  MEDIA_PLAYER: 'media_player',
  SENSOR: 'sensor',
  BINARY_SENSOR: 'binary_sensor',
  CAMERA: 'camera',
  COVER: 'cover',
  FAN: 'fan',
  GROUP: 'group',
  AUTOMATION: 'automation',
  SCRIPT: 'script',
  SCENE: 'scene',
  WEATHER: 'weather'
} as const;

/**
 * Type guard to check if a message is an authentication message
 */
export function isAuthMessage(message: HAWebSocketMessage): message is HAAuthMessage {
  return message.type === 'auth';
}

/**
 * Type guard to check if a message is a service call message
 */
export function isServiceCallMessage(message: HAWebSocketMessage): message is HAServiceCallMessage {
  return message.type === 'call_service';
}

/**
 * Type guard to check if a message is an event message
 */
export function isEventMessage(message: HAWebSocketMessage): message is HAEventMessage {
  return message.type === 'event';
}

/**
 * Type guard to check if a message is a result message
 */
export function isResultMessage(message: HAWebSocketMessage): message is HAResultMessage {
  return message.type === 'result';
}
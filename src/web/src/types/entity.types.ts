/**
 * @file Entity Type Definitions
 * @version 1.0.0
 * 
 * Comprehensive TypeScript type definitions for smart home entities, including
 * states, attributes, configurations, and control interfaces with strict type safety.
 */

import { HAEntityState } from '../../backend/src/types/homeAssistant';

/**
 * Enumeration of all supported entity types in the dashboard
 */
export enum EntityType {
  LIGHT = 'light',
  SWITCH = 'switch',
  CLIMATE = 'climate',
  MEDIA_PLAYER = 'media_player',
  SENSOR = 'sensor',
  BINARY_SENSOR = 'binary_sensor',
  CAMERA = 'camera',
  COVER = 'cover',
  FAN = 'fan',
  LOCK = 'lock'
}

/**
 * Interface defining entity position and orientation on floor plan
 */
export interface EntityPosition {
  /** X coordinate on floor plan (in pixels) */
  x: number;
  /** Y coordinate on floor plan (in pixels) */
  y: number;
  /** Scale factor for entity icon */
  scale: number;
  /** Rotation angle in degrees */
  rotation: number;
}

/**
 * Interface for comprehensive entity configuration
 */
export interface EntityConfig {
  /** Unique entity identifier (format: domain.name) */
  entity_id: string;
  /** Entity type from supported types */
  type: EntityType;
  /** Position and orientation on floor plan */
  position: EntityPosition;
  /** Associated floor plan identifier */
  floor_id: string;
  /** Visibility state on floor plan */
  visible: boolean;
  /** Entity-specific custom settings */
  custom_settings: Record<string, unknown>;
  /** Optional display name override */
  display_name: string | null;
  /** Optional custom icon override */
  icon_override: string | null;
}

/**
 * Enumeration of possible WebSocket connection states
 */
export enum ConnectionState {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

/**
 * Interface for entity context state with performance tracking
 */
export interface EntityContextState {
  /** Map of entity states indexed by entity_id */
  entities: Map<string, HAEntityState>;
  /** Map of entity configurations indexed by entity_id */
  configurations: Map<string, EntityConfig>;
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Timestamp of last update */
  lastUpdate: number;
  /** Current connection state */
  connectionState: ConnectionState;
}

/**
 * Interface for entity control component props
 */
export interface EntityControlProps {
  /** Entity identifier */
  entity_id: string;
  /** Entity configuration */
  config: EntityConfig;
  /** Current entity state */
  state: HAEntityState;
  /** Command handler function */
  onCommand: (command: string, data: Record<string, unknown>) => Promise<void>;
  /** Error handler function */
  onError: (error: Error) => void;
}

/**
 * Interface for entity icon component props
 */
export interface EntityIconProps {
  /** Entity configuration */
  config: EntityConfig;
  /** Current entity state */
  state: HAEntityState;
  /** Tap handler */
  onTap: () => void;
  /** Long press handler */
  onLongPress: () => void;
  /** Drag start handler */
  onDragStart: (event: React.DragEvent) => void;
  /** Drag end handler */
  onDragEnd: (event: React.DragEvent) => void;
}

/**
 * Type definition for entity command handler function
 */
export type EntityCommandHandler = (
  entity_id: string,
  command: string,
  data: Record<string, unknown>
) => Promise<void>;

/**
 * Type definition for entity state change handler function
 */
export type EntityStateChangeHandler = (
  entity_id: string,
  newState: HAEntityState,
  timestamp: number
) => void;
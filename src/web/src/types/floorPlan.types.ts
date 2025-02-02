/**
 * @file Floor Plan Type Definitions
 * @version 1.0.0
 * 
 * Comprehensive TypeScript type definitions for floor plan management, including
 * floor plan structure, entity placement, and related interfaces with strict type safety.
 */

import { EntityPosition } from '../types/entity.types';

/**
 * Interface for floor plan dimensions with aspect ratio support
 */
export interface Dimensions {
  /** Width of the floor plan in pixels */
  width: number;
  /** Height of the floor plan in pixels */
  height: number;
  /** Aspect ratio (width/height) for scaling calculations */
  aspectRatio: number;
}

/**
 * Interface for floor plan metadata tracking
 */
export interface FloorPlanMetadata {
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** User identifier who created the floor plan */
  createdBy: string;
  /** Custom metadata for extensibility */
  customData: Record<string, unknown>;
}

/**
 * Core interface for floor plan data structure
 */
export interface FloorPlan {
  /** Unique floor plan identifier */
  id: string;
  /** Display name of the floor plan */
  name: string;
  /** SVG data as base64 encoded string */
  svgData: string;
  /** Floor plan dimensions */
  dimensions: Dimensions;
  /** Scale factor (pixels per meter) */
  scale: number;
  /** Display order in floor plan list */
  order: number;
  /** Map of entity placements indexed by entity_id */
  entityPlacements: Map<string, EntityPosition>;
  /** Floor plan metadata */
  metadata: FloorPlanMetadata;
}

/**
 * Interface for floor plan upload form data
 */
export interface FloorPlanUploadData {
  /** Display name for the floor plan */
  name: string;
  /** SVG data as base64 encoded string */
  svgData: string;
  /** Scale factor (pixels per meter) */
  scale: number;
  /** Display order preference */
  order: number;
  /** Optional metadata */
  metadata?: Partial<FloorPlanMetadata>;
}

/**
 * Interface for floor plan update operations
 */
export interface FloorPlanUpdateData {
  /** Floor plan identifier */
  id: string;
  /** Updated display name */
  name: string;
  /** Updated scale factor */
  scale: number;
  /** Updated display order */
  order: number;
  /** Updated metadata */
  metadata?: Partial<FloorPlanMetadata>;
}

/**
 * Interface for floor plan view state
 */
export interface FloorPlanViewState {
  /** Current zoom level */
  zoom: number;
  /** Pan position {x, y} */
  pan: { x: number; y: number };
  /** Edit mode indicator */
  isEditing: boolean;
}

/**
 * Interface for floor plan error handling
 */
export interface FloorPlanError {
  /** Error code for identification */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Interface for floor plan context state management
 */
export interface FloorPlanContextState {
  /** Map of floor plans indexed by id */
  floorPlans: Map<string, FloorPlan>;
  /** Currently active floor plan id */
  activeFloorPlan: string | null;
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: FloorPlanError | null;
  /** Current view state */
  viewState: FloorPlanViewState;
}

/**
 * Type definition for floor plan event handler functions
 */
export type FloorPlanEventHandler = (
  floorPlanId: string,
  event: FloorPlanEvent,
  error?: FloorPlanError
) => Promise<void> | void;

/**
 * Union type for floor plan events
 */
export type FloorPlanEvent =
  | 'select'
  | 'update'
  | 'delete'
  | 'entity_placed'
  | 'entity_removed'
  | 'zoom'
  | 'pan'
  | 'error'
  | 'edit_start'
  | 'edit_end';

/**
 * Type for floor plan validation results
 */
export type FloorPlanValidationResult = {
  valid: boolean;
  errors?: FloorPlanError[];
  warnings?: string[];
};

/**
 * Readonly record of error codes for runtime type checking
 */
export const FLOOR_PLAN_ERROR_CODES = {
  INVALID_SVG: 'INVALID_SVG',
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS',
  INVALID_SCALE: 'INVALID_SCALE',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  STORAGE_ERROR: 'STORAGE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
} as const;
/**
 * @file FloorPlan Component Type Definitions
 * @version 1.0.0
 * 
 * Type definitions for the FloorPlan component, including props interface,
 * interaction states, and related types for floor plan visualization and control.
 */

import { type ReactNode } from 'react';
import { type HassEntity } from 'home-assistant-js-websocket'; // v8.0.1
import { type FloorPlan } from '../../../types/floorPlan.types';
import { type EntityPosition } from '../../../types/entity.types';

/**
 * Props interface for the FloorPlan component
 */
export interface FloorPlanProps {
  /** Floor plan data object */
  floorPlan: FloorPlan;
  /** Callback for entity drop events */
  onEntityDrop: (entityId: string, position: EntityPosition) => void;
  /** Callback for zoom level changes */
  onZoom: (scale: number) => void;
  /** Callback for pan position changes */
  onPan: (x: number, y: number) => void;
  /** Callback for entity state updates */
  onStateUpdate: (entityId: string, state: HassEntity) => void;
  /** Error handler callback */
  onError: (error: Error) => void;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional children elements */
  children?: ReactNode;
}

/**
 * Interface for SVG viewBox state management
 */
export interface FloorPlanViewBox {
  /** X coordinate of viewBox */
  x: number;
  /** Y coordinate of viewBox */
  y: number;
  /** Width of viewBox */
  width: number;
  /** Height of viewBox */
  height: number;
  /** Current scale factor */
  scale: number;
}

/**
 * Type definition for supported interaction types
 */
export type InteractionType = 'tap' | 'longPress' | 'drag' | 'pinch';

/**
 * Interface for tracking floor plan interaction state
 */
export interface FloorPlanInteractionState {
  /** Flag indicating active interaction */
  isInteracting: boolean;
  /** Current interaction type */
  interactionType: InteractionType | null;
  /** Timer for long press detection */
  interactionTimeout: number | null;
  /** Distance for gesture detection */
  gestureDistance: number;
  /** Start position for gesture tracking */
  startPosition?: { x: number; y: number };
}

/**
 * Type definition for zoom level constraints
 */
export type ZoomLevel = number;

/**
 * Type definition for pan event handler
 */
export type PanHandler = (x: number, y: number) => void;

/**
 * Interface for styled-components props
 */
export interface FloorPlanStyleProps {
  /** Flag indicating drag operation */
  isDragging: boolean;
  /** Current scale factor */
  scale: number;
  /** Loading state indicator */
  isLoading: boolean;
  /** Error state indicator */
  hasError: boolean;
}

/**
 * Constants for floor plan interaction and visualization
 */
export const MIN_ZOOM: ZoomLevel = 0.5;
export const MAX_ZOOM: ZoomLevel = 3.0;
export const GRID_SIZE = 20;
export const INTERACTION_TIMEOUT = 500;
export const MIN_GESTURE_DISTANCE = 10;

/**
 * Interface for floor plan grid configuration
 */
export interface GridConfig {
  /** Grid size in pixels */
  size: number;
  /** Grid visibility flag */
  visible: boolean;
  /** Grid snap enabled flag */
  snapToGrid: boolean;
  /** Grid color */
  color: string;
  /** Grid opacity */
  opacity: number;
}

/**
 * Interface for floor plan gesture state
 */
export interface GestureState {
  /** Active gesture type */
  type: InteractionType | null;
  /** Initial touch/click position */
  initialPosition: { x: number; y: number } | null;
  /** Current scale for pinch gestures */
  scale: number;
  /** Initial distance for pinch gestures */
  initialDistance: number | null;
  /** Gesture start timestamp */
  startTime: number | null;
}

/**
 * Type definition for entity placement validation
 */
export type PlacementValidation = {
  /** Validation success flag */
  isValid: boolean;
  /** Validation error message */
  error?: string;
  /** Suggested position adjustments */
  suggestions?: Partial<EntityPosition>;
};

/**
 * Interface for floor plan rendering options
 */
export interface RenderOptions {
  /** Show grid flag */
  showGrid: boolean;
  /** Show entity labels flag */
  showLabels: boolean;
  /** Show dimensions flag */
  showDimensions: boolean;
  /** High quality rendering flag */
  highQuality: boolean;
  /** Debug visualization flag */
  debug: boolean;
}
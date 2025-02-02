/**
 * @file Drag and Drop Utility Functions
 * @version 1.0.0
 * 
 * Provides utility functions for handling drag and drop operations of smart home entities
 * on the floor plan interface with support for precise positioning, grid snapping,
 * and scale-aware calculations.
 */

import { EntityPosition } from '../types/entity.types';

// Constants for drag and drop behavior configuration
const DEFAULT_GRID_SIZE = 10;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;
const POSITION_UPDATE_DEBOUNCE_MS = 16;
const BOUNDARY_MARGIN = 20;

/**
 * Extended type for drag events supporting both mouse and touch interactions
 */
interface DragEvent {
  clientX: number;
  clientY: number;
  target: EventTarget;
  touches?: TouchList;
  scale?: number;
}

/**
 * Calculates the new position of an entity during drag operation
 * @param event - Mouse or touch event containing position data
 * @param container - Container element reference for boundary calculations
 * @returns Calculated position with coordinates and scale
 */
export const calculateDragPosition = (
  event: MouseEvent | TouchEvent,
  container: HTMLElement
): EntityPosition => {
  let clientX: number;
  let clientY: number;

  // Extract coordinates based on event type
  if ('touches' in event && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else if ('clientX' in event) {
    clientX = event.clientX;
    clientY = event.clientY;
  } else {
    throw new Error('Invalid event type for drag operation');
  }

  // Get container dimensions and position
  const containerRect = container.getBoundingClientRect();
  const containerScale = window.devicePixelRatio || 1;

  // Calculate relative position within container
  const x = (clientX - containerRect.left) / containerScale;
  const y = (clientY - containerRect.top) / containerScale;

  // Apply container transformations if any
  const matrix = new DOMMatrix(getComputedStyle(container).transform);
  const transformedX = (x - matrix.e) / matrix.a;
  const transformedY = (y - matrix.f) / matrix.d;

  // Calculate scale based on event or use default
  const scale = ('scale' in event && event.scale) || 1.0;

  // Return normalized position
  return {
    x: Math.max(BOUNDARY_MARGIN, Math.min(containerRect.width - BOUNDARY_MARGIN, transformedX)),
    y: Math.max(BOUNDARY_MARGIN, Math.min(containerRect.height - BOUNDARY_MARGIN, transformedY)),
    scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)),
    rotation: 0 // Default rotation, can be extended for rotation support
  };
};

/**
 * Validates if a drop position is within allowed bounds
 * @param position - Position to validate
 * @param container - Container element reference
 * @returns Boolean indicating if position is valid
 */
export const validateDropPosition = (
  position: EntityPosition,
  container: HTMLElement
): boolean => {
  const containerRect = container.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;

  // Check x-axis bounds
  const isValidX = position.x >= BOUNDARY_MARGIN && 
                   position.x <= (containerRect.width / scale) - BOUNDARY_MARGIN;

  // Check y-axis bounds
  const isValidY = position.y >= BOUNDARY_MARGIN && 
                   position.y <= (containerRect.height / scale) - BOUNDARY_MARGIN;

  // Check scale bounds
  const isValidScale = position.scale >= MIN_SCALE && position.scale <= MAX_SCALE;

  return isValidX && isValidY && isValidScale;
};

/**
 * Snaps a position to the nearest grid point
 * @param position - Position to snap to grid
 * @param gridSize - Size of the grid (optional, defaults to DEFAULT_GRID_SIZE)
 * @returns Snapped position
 */
export const snapToGrid = (
  position: EntityPosition,
  gridSize: number = DEFAULT_GRID_SIZE
): EntityPosition => {
  // Apply scale factor to grid size
  const effectiveGridSize = gridSize * position.scale;

  // Calculate snapped coordinates
  const snappedX = Math.round(position.x / effectiveGridSize) * effectiveGridSize;
  const snappedY = Math.round(position.y / effectiveGridSize) * effectiveGridSize;

  return {
    x: snappedX,
    y: snappedY,
    scale: position.scale,
    rotation: position.rotation
  };
};

/**
 * Debounces position updates for performance optimization
 * @param callback - Function to debounce
 * @returns Debounced function
 */
export const debouncePositionUpdate = <T extends (...args: any[]) => any>(
  callback: T
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number;

  return (...args: Parameters<T>) => {
    window.cancelAnimationFrame(timeoutId);
    timeoutId = window.requestAnimationFrame(() => {
      callback(...args);
    });
  };
};

/**
 * Calculates the scale factor for an entity based on container dimensions
 * @param container - Container element reference
 * @returns Calculated scale factor
 */
export const calculateScaleFactor = (container: HTMLElement): number => {
  const containerRect = container.getBoundingClientRect();
  const containerScale = window.devicePixelRatio || 1;
  const minDimension = Math.min(containerRect.width, containerRect.height);
  
  return Math.max(
    MIN_SCALE,
    Math.min(MAX_SCALE, (minDimension / containerScale) / 1000)
  );
};

/**
 * Normalizes touch coordinates for multi-touch gestures
 * @param touches - Touch list from touch event
 * @returns Normalized coordinates
 */
export const normalizeTouchCoordinates = (touches: TouchList): { x: number; y: number } => {
  if (touches.length === 0) {
    throw new Error('No touches available');
  }

  if (touches.length === 1) {
    return {
      x: touches[0].clientX,
      y: touches[0].clientY
    };
  }

  // Calculate center point for multi-touch
  const touchPoints = Array.from(touches);
  const sumX = touchPoints.reduce((sum, touch) => sum + touch.clientX, 0);
  const sumY = touchPoints.reduce((sum, touch) => sum + touch.clientY, 0);

  return {
    x: sumX / touches.length,
    y: sumY / touches.length
  };
};
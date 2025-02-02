/**
 * @file EntityIcon Type Definitions
 * @version 1.0.0
 * 
 * Type definitions for the EntityIcon component, defining props and event handlers
 * for interactive entity icons displayed on the floor plan with support for
 * tap, long-press, and drag-drop interactions.
 */

import { MouseEvent, TouchEvent } from 'react';
import { EntityType, EntityConfig } from '../../types/entity.types';
import { Theme } from '../../types/theme.types';

/**
 * Props interface for the EntityIcon component
 */
export interface EntityIconProps {
  /** Entity configuration containing ID, type, and position */
  config: EntityConfig;
  
  /** Current entity state value */
  state: string;
  
  /** Theme configuration for icon styling */
  theme: Theme;
  
  /** Handler for tap/click interactions */
  onTap: (entity_id: string) => void;
  
  /** Handler for long-press interactions (500ms) */
  onLongPress: (entity_id: string) => void;
  
  /** Handler for drag start events */
  onDragStart: (event: MouseEvent | TouchEvent) => void;
  
  /** Handler for drag end events */
  onDragEnd: (event: MouseEvent | TouchEvent) => void;
}

/**
 * Internal state interface for the EntityIcon component
 */
export interface EntityIconState {
  /** Indicates if the icon is currently being pressed */
  isPressed: boolean;
  
  /** Timer ID for long-press detection */
  pressTimer: number | null;
  
  /** Indicates if the icon is currently being dragged */
  isDragging: boolean;
}

/**
 * Type definition for entity icon event handlers
 */
export type EntityIconEventHandler = (
  event: MouseEvent | TouchEvent,
  entity_id: string
) => void;

/**
 * Interface for EntityIcon component styling
 */
export interface EntityIconStyles {
  /** Absolute positioning for placement on floor plan */
  position: 'absolute';
  
  /** Transform for position, scale, and rotation */
  transform: string;
  
  /** Cursor style based on interaction state */
  cursor: string;
  
  /** Opacity for visual feedback */
  opacity: number;
}

/**
 * Constant for long press duration in milliseconds
 */
export const LONG_PRESS_DURATION = 500;

/**
 * Map of entity types to their default icon styles
 */
export const ENTITY_ICON_STYLES: Record<EntityType, Partial<EntityIconStyles>> = {
  [EntityType.LIGHT]: {
    cursor: 'pointer',
    opacity: 1
  },
  [EntityType.SWITCH]: {
    cursor: 'pointer',
    opacity: 1
  },
  [EntityType.CLIMATE]: {
    cursor: 'pointer',
    opacity: 1
  },
  [EntityType.MEDIA_PLAYER]: {
    cursor: 'pointer',
    opacity: 1
  }
};

/**
 * Type guard to check if an entity type supports drag-drop
 */
export function supportsDragDrop(type: EntityType): boolean {
  return [
    EntityType.LIGHT,
    EntityType.SWITCH,
    EntityType.CLIMATE,
    EntityType.MEDIA_PLAYER
  ].includes(type);
}
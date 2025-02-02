/**
 * @file EntityList Type Definitions
 * @version 1.0.0
 * 
 * TypeScript type definitions for the EntityList component, providing comprehensive
 * type safety for entity list management, filtering, and drag-and-drop functionality.
 */

import React from 'react';
import { EntityType, EntityConfig } from '../../types/entity.types';
import { IconType } from '../../common/Icon/Icon.types';

/**
 * Props interface for the EntityList component
 */
export interface EntityListProps {
  /** Array of entity configurations to display in the list */
  entities: EntityConfig[];
  
  /** Currently selected entity type filter */
  selectedType: EntityType | null;
  
  /** Current search query for entity filtering */
  searchQuery: string;
  
  /** Handler for entity drag start events */
  onDragStart: (entity: EntityConfig, event: React.DragEvent) => void;
  
  /** Handler for entity selection events */
  onSelect: (entity: EntityConfig) => void;
  
  /** Flag to enable virtualized list rendering for performance */
  virtualized?: boolean;
}

/**
 * Props interface for individual entity list items
 */
export interface EntityListItemProps {
  /** Entity configuration for the list item */
  entity: EntityConfig;
  
  /** Flag indicating if the item is currently being dragged */
  isDragging: boolean;
  
  /** Flag indicating if the item is currently selected */
  isSelected: boolean;
  
  /** Handler for drag start events */
  onDragStart: (event: React.DragEvent) => void;
  
  /** Handler for selection events */
  onSelect: () => void;
  
  /** Current animation state of the entity item */
  animationState: EntityAnimationState;
}

/**
 * Type definition for entity filtering options
 */
export type EntityFilter = {
  /** Entity type filter */
  type: EntityType | null;
  
  /** Search query filter */
  query: string;
}

/**
 * Interface for EntityList component internal state
 */
export interface EntityListState {
  /** Array of filtered entities based on current filter criteria */
  filteredEntities: EntityConfig[];
  
  /** Loading state indicator */
  loading: boolean;
  
  /** Error state message */
  error: string | null;
  
  /** Performance metrics for list operations */
  performance: EntityListPerformanceMetrics;
}

/**
 * Type definition for entity filtering function
 */
export type EntityFilterFunction = (
  entities: EntityConfig[],
  filter: EntityFilter
) => EntityConfig[];

/**
 * Enumeration of entity animation states during drag operations
 */
export enum EntityAnimationState {
  /** Default state - no animation */
  IDLE = 'idle',
  
  /** Entity is being dragged */
  DRAGGING = 'dragging',
  
  /** Entity is being dropped */
  DROPPING = 'dropping'
}

/**
 * Interface for tracking entity list performance metrics
 */
export interface EntityListPerformanceMetrics {
  /** Time taken for last filter operation (ms) */
  filterTime: number;
  
  /** Time taken for last render operation (ms) */
  renderTime: number;
  
  /** Number of rendered items */
  itemCount: number;
  
  /** Number of visible items in viewport */
  visibleItems: number;
}

/**
 * Interface for entity list sorting options
 */
export interface EntitySortOptions {
  /** Sort field */
  field: 'name' | 'type' | 'state' | 'lastUpdated';
  
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Interface for entity list group configuration
 */
export interface EntityGroupConfig {
  /** Group type */
  type: EntityType;
  
  /** Group icon */
  icon: IconType;
  
  /** Group title */
  title: string;
  
  /** Optional group description */
  description?: string;
  
  /** Flag to expand/collapse group */
  expanded: boolean;
}

/**
 * Type definition for entity list view modes
 */
export type EntityListViewMode = 'list' | 'grid' | 'compact';

/**
 * Interface for entity list drag and drop context
 */
export interface EntityDragDropContext {
  /** Currently dragged entity */
  draggedEntity: EntityConfig | null;
  
  /** Drop target information */
  dropTarget: {
    id: string;
    type: 'floorplan' | 'group' | 'zone';
  } | null;
  
  /** Drag operation status */
  isDragging: boolean;
}
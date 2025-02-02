/**
 * @file Sidebar Type Definitions
 * @version 1.0.0
 * 
 * Type definitions for the dashboard sidebar component, providing comprehensive
 * type safety for floor plan selection and entity list management.
 */

import { ReactNode } from 'react'; // v18.0.0
import { FloorPlan } from '../../../types/floorPlan.types';
import { EntityType } from '../../../types/entity.types';
import { HAEntityState } from '../../../backend/src/types/homeAssistant';

/**
 * Theme variants for the sidebar component
 */
export type SidebarTheme = 'light' | 'dark' | 'system';

/**
 * Constant object defining available sidebar sections with type safety
 */
export const SIDEBAR_SECTIONS = {
  FLOOR_PLANS: 'floor_plans',
  ENTITIES: 'entities'
} as const;

/**
 * Type definition for sidebar section identifiers
 */
export type SidebarSection = typeof SIDEBAR_SECTIONS[keyof typeof SIDEBAR_SECTIONS];

/**
 * Interface for the sidebar component's props
 */
export interface SidebarProps {
  /** Child elements to render within the sidebar */
  children?: ReactNode;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Theme variant for the sidebar */
  theme: SidebarTheme;
  /** Initial collapsed state */
  initialCollapsed?: boolean;
  /** Callback for sidebar collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * Interface for the sidebar's internal state
 */
export interface SidebarState {
  /** Currently active section */
  activeSection: SidebarSection | null;
  /** Collapsed state of the sidebar */
  isCollapsed: boolean;
  /** Timestamp of last user interaction */
  lastInteraction: Date | null;
}

/**
 * Interface for floor plan section props
 */
export interface FloorPlanSectionProps {
  /** Array of available floor plans (readonly to prevent mutations) */
  floorPlans: readonly FloorPlan[];
  /** Currently active floor plan ID */
  activeFloorPlan: string | null;
  /** Callback for floor plan selection */
  onFloorPlanSelect: (id: string) => void;
  /** Optional loading state */
  isLoading?: boolean;
  /** Optional error state */
  error?: Error | null;
}

/**
 * Interface for entity list section props
 */
export interface EntityListSectionProps {
  /** Map of entity states indexed by entity_id (readonly for immutability) */
  entities: ReadonlyMap<string, HAEntityState>;
  /** Currently selected entity type filter */
  selectedType: EntityType | null;
  /** Callback for entity type selection */
  onTypeSelect: (type: EntityType) => void;
  /** Callback for entity drag start event */
  onEntityDragStart: (entityId: string, event: React.DragEvent) => void;
  /** Optional search query */
  searchQuery?: string;
  /** Optional loading state */
  isLoading?: boolean;
  /** Optional error state */
  error?: Error | null;
}

/**
 * Interface for entity list item props
 */
export interface EntityListItemProps {
  /** Entity identifier */
  entityId: string;
  /** Entity state */
  state: HAEntityState;
  /** Drag event handler */
  onDragStart: (event: React.DragEvent) => void;
  /** Click event handler */
  onClick?: () => void;
  /** Whether the item is currently selected */
  isSelected?: boolean;
}

/**
 * Interface for sidebar header props
 */
export interface SidebarHeaderProps {
  /** Title text */
  title: string;
  /** Whether the sidebar is collapsed */
  isCollapsed: boolean;
  /** Collapse toggle callback */
  onToggleCollapse: () => void;
  /** Theme variant */
  theme: SidebarTheme;
}

/**
 * Type definition for sidebar animation states
 */
export type SidebarAnimationState = 'entering' | 'entered' | 'exiting' | 'exited';

/**
 * Interface for sidebar transition props
 */
export interface SidebarTransitionProps {
  /** Current animation state */
  animationState: SidebarAnimationState;
  /** Animation duration in milliseconds */
  duration: number;
  /** Children elements */
  children: ReactNode;
}

/**
 * Type definition for entity filter function
 */
export type EntityFilterFn = (entity: HAEntityState) => boolean;

/**
 * Interface for entity group header props
 */
export interface EntityGroupHeaderProps {
  /** Entity type for the group */
  type: EntityType;
  /** Number of entities in the group */
  count: number;
  /** Whether the group is expanded */
  isExpanded: boolean;
  /** Expand toggle callback */
  onToggleExpand: () => void;
}
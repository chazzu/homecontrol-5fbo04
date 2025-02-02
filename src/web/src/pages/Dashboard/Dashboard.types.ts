/**
 * @file Dashboard Type Definitions
 * @version 1.0.0
 * 
 * Comprehensive TypeScript type definitions for the main Dashboard component,
 * including props, state interfaces, event handlers, and performance monitoring.
 */

import { EntityType } from '../../types/entity.types';
import { FloorPlan } from '../../types/floorPlan.types';
import { HAEntityState } from '../../types/entity.types';

/**
 * Props interface for the Dashboard component
 */
export interface DashboardProps {
  /** Optional class name for styling */
  className?: string;
}

/**
 * Enumeration of possible connection states
 */
export enum ConnectionState {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error'
}

/**
 * Interface for tracking dashboard performance metrics
 */
export interface DashboardPerformanceMetrics {
  /** Time taken for component render in milliseconds */
  renderTime: number;
  /** Latency between state update request and completion in milliseconds */
  stateUpdateLatency: number;
  /** Count of entity updates processed */
  entityUpdateCount: number;
  /** Timestamp of last user interaction */
  lastInteractionTime: number;
  /** Current frame rate for animations */
  frameRate: number;
  /** WebSocket message latency in milliseconds */
  wsLatency: number;
  /** Memory usage in MB */
  memoryUsage: number;
}

/**
 * Main state interface for the Dashboard component
 */
export interface DashboardState {
  /** ID of the currently active floor plan */
  activeFloorPlanId: string | null;
  /** ID of the currently selected entity */
  selectedEntityId: string | null;
  /** Control dialog visibility state */
  isControlDialogOpen: boolean;
  /** Upload dialog visibility state */
  isUploadDialogOpen: boolean;
  /** Current entity type filter */
  entityFilter: EntityType | null;
  /** Error state */
  error: Error | null;
  /** Current connection state */
  connectionStatus: ConnectionState;
  /** Last state update timestamp */
  lastUpdateTimestamp: number;
  /** Map of entity states */
  entityStates: Map<string, HAEntityState>;
  /** Performance metrics */
  performanceMetrics: DashboardPerformanceMetrics;
}

/**
 * Interface for Dashboard context value
 */
export interface DashboardContextValue {
  /** Current dashboard state */
  state: DashboardState;
  /** Function to set active floor plan */
  setActiveFloorPlan: (id: string | null) => void;
  /** Function to set selected entity */
  setSelectedEntity: (id: string | null) => void;
  /** Function to set entity filter */
  setEntityFilter: (type: EntityType | null) => void;
  /** Function to toggle control dialog */
  toggleControlDialog: () => void;
  /** Function to toggle upload dialog */
  toggleUploadDialog: () => void;
  /** Function to update performance metrics */
  updatePerformanceMetrics: (metrics: Partial<DashboardPerformanceMetrics>) => void;
  /** Function to handle connection state changes */
  handleConnectionStateChange: (state: ConnectionState) => void;
  /** Function to handle errors */
  handleError: (error: Error) => void;
  /** Function to refresh entity states */
  refreshEntityStates: () => Promise<void>;
  /** Function to handle entity commands */
  handleEntityCommand: (entityId: string, command: string, data: Record<string, unknown>) => Promise<void>;
}

/**
 * Type definition for entity filter change handler
 */
export type EntityFilterChangeHandler = (type: EntityType | null) => void;

/**
 * Type definition for floor plan change handler
 */
export type FloorPlanChangeHandler = (id: string | null) => void;

/**
 * Type definition for entity selection handler
 */
export type EntitySelectionHandler = (id: string | null) => void;

/**
 * Type definition for connection state change handler
 */
export type ConnectionStateHandler = (state: ConnectionState) => void;

/**
 * Type definition for performance metrics update handler
 */
export type PerformanceMetricsHandler = (metrics: Partial<DashboardPerformanceMetrics>) => void;

/**
 * Interface for dashboard error state
 */
export interface DashboardError extends Error {
  /** Error code for categorization */
  code: string;
  /** Additional error context */
  context?: Record<string, unknown>;
}

/**
 * Type definition for dashboard event handlers
 */
export type DashboardEventHandler<T = unknown> = (event: T) => void | Promise<void>;

/**
 * Interface for dashboard view state
 */
export interface DashboardViewState {
  /** Current zoom level */
  zoom: number;
  /** Pan position */
  pan: { x: number; y: number };
  /** Sidebar collapsed state */
  isSidebarCollapsed: boolean;
  /** Current view mode */
  viewMode: 'edit' | 'view';
}
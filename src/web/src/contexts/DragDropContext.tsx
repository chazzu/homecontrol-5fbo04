/**
 * @file DragDropContext - React Context for managing drag and drop functionality
 * @version 1.0.0
 * 
 * Provides centralized state management and handlers for entity positioning
 * with enhanced error handling, performance optimizations, and grid snapping support.
 */

import { createContext, useContext, useRef, memo, ReactNode } from 'react'; // ^18.0.0
import { useDragDrop } from '../hooks/useDragDrop';
import { EntityPosition } from '../types/entity.types';

// Constants for drag and drop behavior
const DEFAULT_GRID_SIZE = 10;
const POSITION_DECIMAL_PLACES = 2;
const DRAG_UPDATE_INTERVAL = 1000 / 60;

/**
 * Interface defining the drag and drop context state
 */
interface DragDropContextState {
  isDragging: boolean;
  currentPosition: EntityPosition | null;
  draggedEntityId: string | null;
  lastUpdateTimestamp: number;
}

/**
 * Interface defining the drag and drop context value
 */
interface DragDropContextValue {
  state: DragDropContextState;
  handleDragStart: (event: React.MouseEvent | React.TouchEvent, entityId: string) => void;
  handleDrag: (event: MouseEvent | TouchEvent) => void;
  handleDragEnd: (event: MouseEvent | TouchEvent) => void;
  isValidPosition: (position: EntityPosition) => boolean;
}

/**
 * Interface for DragDropProvider component props
 */
interface DragDropProviderProps {
  children: ReactNode;
  containerRef: React.RefObject<HTMLElement>;
  gridSize?: number;
  onPositionChange: (entityId: string, position: EntityPosition) => void;
  validationBounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

// Create context with strict type checking
const DragDropContext = createContext<DragDropContextValue | null>(null);

/**
 * Provider component for drag and drop functionality
 */
const DragDropProvider = memo(({
  children,
  containerRef,
  gridSize = DEFAULT_GRID_SIZE,
  onPositionChange,
  validationBounds
}: DragDropProviderProps) => {
  // Initialize drag and drop hook with configuration
  const {
    isDragging,
    currentPosition,
    draggedEntityId,
    handleDragStart: onDragStart,
    handleDrag: onDrag,
    handleDragEnd: onDragEnd,
    abortDrag
  } = useDragDrop({
    containerRef,
    gridSize,
    onPositionChange,
    enableScaling: true,
    boundaryPadding: 20
  });

  // Reference for tracking animation frame requests
  const animationFrameRef = useRef<number>();

  /**
   * Validates if a position is within bounds
   */
  const isValidPosition = (position: EntityPosition): boolean => {
    if (!validationBounds) return true;

    const { minX, maxX, minY, maxY } = validationBounds;
    const { x, y } = position;

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  };

  /**
   * Enhanced drag start handler with error boundary
   */
  const handleDragStart = (event: React.MouseEvent | React.TouchEvent, entityId: string) => {
    try {
      if (!containerRef.current) {
        throw new Error('Container reference is not available');
      }
      onDragStart(event, entityId);
    } catch (error) {
      console.error('Error starting drag operation:', error);
      abortDrag();
    }
  };

  /**
   * Enhanced drag handler with performance optimization
   */
  const handleDrag = (event: MouseEvent | TouchEvent) => {
    try {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        onDrag(event);
      });
    } catch (error) {
      console.error('Error during drag operation:', error);
      abortDrag();
    }
  };

  /**
   * Enhanced drag end handler with position validation
   */
  const handleDragEnd = (event: MouseEvent | TouchEvent) => {
    try {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (currentPosition && !isValidPosition(currentPosition)) {
        throw new Error('Invalid drop position');
      }

      onDragEnd(event);
    } catch (error) {
      console.error('Error ending drag operation:', error);
      abortDrag();
    }
  };

  // Create memoized context value
  const contextValue: DragDropContextValue = {
    state: {
      isDragging,
      currentPosition,
      draggedEntityId,
      lastUpdateTimestamp: Date.now()
    },
    handleDragStart,
    handleDrag,
    handleDragEnd,
    isValidPosition
  };

  return (
    <DragDropContext.Provider value={contextValue}>
      {children}
    </DragDropContext.Provider>
  );
});

// Set display name for debugging
DragDropProvider.displayName = 'DragDropProvider';

/**
 * Custom hook to access drag and drop context with runtime validation
 */
const useDragDropContext = (): DragDropContextValue => {
  const context = useContext(DragDropContext);
  
  if (!context) {
    throw new Error('useDragDropContext must be used within a DragDropProvider');
  }

  return context;
};

// Export context, provider, and hook
export {
  DragDropContext,
  DragDropProvider,
  useDragDropContext,
  type DragDropContextState,
  type DragDropContextValue,
  type DragDropProviderProps
};
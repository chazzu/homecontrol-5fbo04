/**
 * @file Custom React hook for drag and drop functionality
 * @version 1.0.0
 * 
 * Provides optimized drag and drop functionality for positioning smart home entities
 * on the floor plan interface with support for grid snapping, scale-aware positioning,
 * and performance optimization through requestAnimationFrame.
 */

import { useState, useRef, useCallback, useEffect } from 'react'; // ^18.0.0
import { EntityPosition } from '../types/entity.types';
import { 
  calculateDragPosition, 
  validateDropPosition, 
  snapToGrid 
} from '../utils/dragDrop';

// Constants for drag and drop behavior
const DEFAULT_GRID_SIZE = 10;
const DRAG_UPDATE_INTERVAL = 16;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;

/**
 * Props for the useDragDrop hook
 */
interface UseDragDropProps {
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLElement>;
  /** Grid size for snapping (in pixels) */
  gridSize?: number;
  /** Callback for position changes */
  onPositionChange: (entityId: string, position: EntityPosition) => void;
  /** Enable/disable scaling during drag */
  enableScaling?: boolean;
  /** Padding from container boundaries (in pixels) */
  boundaryPadding?: number;
}

/**
 * Return type for the useDragDrop hook
 */
interface UseDragDropReturn {
  /** Current dragging state */
  isDragging: boolean;
  /** Current position of dragged entity */
  currentPosition: EntityPosition | null;
  /** ID of currently dragged entity */
  draggedEntityId: string | null;
  /** Handler for drag start events */
  handleDragStart: (event: React.MouseEvent | React.TouchEvent, entityId: string) => void;
  /** Handler for drag events */
  handleDrag: (event: MouseEvent | TouchEvent) => void;
  /** Handler for drag end events */
  handleDragEnd: (event: MouseEvent | TouchEvent) => void;
  /** Function to abort current drag operation */
  abortDrag: () => void;
}

/**
 * Custom hook that provides optimized drag and drop functionality
 * with grid snapping and scale support
 */
const useDragDrop = ({
  containerRef,
  gridSize = DEFAULT_GRID_SIZE,
  onPositionChange,
  enableScaling = true,
  boundaryPadding = 20
}: UseDragDropProps): UseDragDropReturn => {
  // State for tracking drag operation
  const [isDragging, setIsDragging] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<EntityPosition | null>(null);
  const [draggedEntityId, setDraggedEntityId] = useState<string | null>(null);

  // Refs for animation frame and initial position
  const animationFrameRef = useRef<number>();
  const initialPositionRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Cleanup function for drag operation
   */
  const cleanupDrag = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsDragging(false);
    setCurrentPosition(null);
    setDraggedEntityId(null);
    initialPositionRef.current = null;
  }, []);

  /**
   * Handler for drag start events
   */
  const handleDragStart = useCallback((
    event: React.MouseEvent | React.TouchEvent,
    entityId: string
  ) => {
    event.preventDefault();
    
    if (!containerRef.current) return;

    const position = calculateDragPosition(
      event.nativeEvent as MouseEvent | TouchEvent,
      containerRef.current
    );

    initialPositionRef.current = { x: position.x, y: position.y };
    setDraggedEntityId(entityId);
    setIsDragging(true);
    setCurrentPosition(position);
  }, [containerRef]);

  /**
   * Handler for drag events with requestAnimationFrame optimization
   */
  const handleDrag = useCallback((event: MouseEvent | TouchEvent) => {
    event.preventDefault();

    if (!isDragging || !containerRef.current || !draggedEntityId) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const newPosition = calculateDragPosition(event, containerRef.current);
      const snappedPosition = snapToGrid(newPosition, gridSize);

      if (validateDropPosition(snappedPosition, containerRef.current)) {
        setCurrentPosition(snappedPosition);
        onPositionChange(draggedEntityId, snappedPosition);
      }
    });
  }, [isDragging, containerRef, draggedEntityId, gridSize, onPositionChange]);

  /**
   * Handler for drag end events
   */
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent) => {
    event.preventDefault();

    if (!isDragging || !containerRef.current || !currentPosition || !draggedEntityId) {
      cleanupDrag();
      return;
    }

    const finalPosition = snapToGrid(currentPosition, gridSize);
    
    if (validateDropPosition(finalPosition, containerRef.current)) {
      onPositionChange(draggedEntityId, finalPosition);
    }

    cleanupDrag();
  }, [isDragging, containerRef, currentPosition, draggedEntityId, gridSize, onPositionChange, cleanupDrag]);

  /**
   * Function to abort current drag operation
   */
  const abortDrag = useCallback(() => {
    cleanupDrag();
  }, [cleanupDrag]);

  /**
   * Effect for setting up and cleaning up event listeners
   */
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('touchmove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
      window.addEventListener('touchcancel', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('touchmove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);

  return {
    isDragging,
    currentPosition,
    draggedEntityId,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    abortDrag
  };
};

export default useDragDrop;
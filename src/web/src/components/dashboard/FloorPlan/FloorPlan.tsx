import React, { useCallback, useEffect, useRef, useState } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { useGesture } from 'react-use-gesture'; // v9.1.3
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import { FloorPlanProps } from './FloorPlan.types';
import { useFloorPlan } from '../../../hooks/useFloorPlan';
import { PERFORMANCE_THRESHOLDS, UI_CONSTANTS } from '../../../config/constants';

// Constants for component behavior
const MIN_ZOOM = UI_CONSTANTS.minZoom;
const MAX_ZOOM = UI_CONSTANTS.maxZoom;
const GRID_SIZE = 20;
const ACCELERATION_FACTOR = 1.5;
const INERTIA_FACTOR = 0.95;

// Styled components for floor plan visualization
const FloorPlanContainer = styled.div<{ isDragging: boolean; isLoading: boolean }>`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: ${({ isDragging }) => (isDragging ? 'grabbing' : 'grab')};
  opacity: ${({ isLoading }) => (isLoading ? 0.7 : 1)};
  transition: opacity 0.3s ease;
`;

const SVGContainer = styled.svg`
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
  will-change: transform;
`;

const Grid = styled.g`
  stroke: rgba(0, 0, 0, 0.1);
  stroke-width: 1;
`;

const EntityLayer = styled.g`
  pointer-events: all;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  z-index: 10;
`;

/**
 * FloorPlan Component
 * Renders an interactive SVG floor plan with support for entity placement,
 * zooming, panning, and drag-and-drop functionality.
 */
const FloorPlan: React.FC<FloorPlanProps> = ({
  floorPlan,
  onEntityDrop,
  onZoom,
  onPan,
  onStateUpdate,
  onError,
  isLoading = false,
  className,
  children
}) => {
  // Refs for DOM elements and animation
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>();
  
  // State management
  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    width: floorPlan.dimensions.width,
    height: floorPlan.dimensions.height,
    scale: 1,
    acceleration: 1,
    inertia: 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const [gestureState, setGestureState] = useState<'idle' | 'pan' | 'zoom'>('idle');

  // Custom hooks
  const { updateEntityPosition, validatePosition } = useFloorPlan();

  /**
   * Performance monitoring for gesture handling
   */
  const monitorPerformance = useCallback((operation: string, duration: number) => {
    if (duration > PERFORMANCE_THRESHOLDS.maxResponseTime) {
      console.warn(`${operation} took ${duration}ms`);
    }
  }, []);

  /**
   * Handles zoom gestures with enhanced pinch support and acceleration
   */
  const handleZoom = useCallback(({ delta: [, dy], event }) => {
    const startTime = performance.now();

    event.preventDefault();
    setGestureState('zoom');

    setViewBox(prev => {
      const acceleration = prev.acceleration * ACCELERATION_FACTOR;
      const scaleDelta = -dy * 0.01 * acceleration;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.scale + scaleDelta));

      // Calculate zoom center point
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return prev;

      const mouseX = (event.clientX - rect.left) / rect.width * prev.width;
      const mouseY = (event.clientY - rect.top) / rect.height * prev.height;

      // Adjust viewBox to zoom around mouse position
      const widthDelta = prev.width * (1 - newScale / prev.scale);
      const heightDelta = prev.height * (1 - newScale / prev.scale);
      
      const newViewBox = {
        x: prev.x + (mouseX / prev.width) * widthDelta,
        y: prev.y + (mouseY / prev.height) * heightDelta,
        width: prev.width * (prev.scale / newScale),
        height: prev.height * (prev.scale / newScale),
        scale: newScale,
        acceleration,
        inertia: 0
      };

      onZoom(newScale);
      monitorPerformance('Zoom operation', performance.now() - startTime);
      return newViewBox;
    });
  }, [onZoom, monitorPerformance]);

  /**
   * Handles pan gestures with inertia and boundary detection
   */
  const handlePan = useCallback(({ delta: [dx, dy], event, last }) => {
    const startTime = performance.now();

    event.preventDefault();
    setGestureState('pan');
    setIsDragging(!last);

    setViewBox(prev => {
      const acceleration = last ? 1 : prev.acceleration * ACCELERATION_FACTOR;
      const inertia = last ? prev.acceleration * INERTIA_FACTOR : 0;

      // Calculate new position with boundaries
      const newX = Math.max(
        -prev.width * 0.5,
        Math.min(prev.width * 1.5, prev.x - dx / prev.scale)
      );
      const newY = Math.max(
        -prev.height * 0.5,
        Math.min(prev.height * 1.5, prev.y - dy / prev.scale)
      );

      const newViewBox = {
        ...prev,
        x: newX,
        y: newY,
        acceleration,
        inertia
      };

      onPan(newX, newY);
      monitorPerformance('Pan operation', performance.now() - startTime);
      return newViewBox;
    });
  }, [onPan, monitorPerformance]);

  /**
   * Handles entity drop with grid snapping and collision detection
   */
  const handleDrop = useCallback(async (event: React.DragEvent) => {
    const startTime = performance.now();

    try {
      event.preventDefault();
      const entityId = event.dataTransfer.getData('entity_id');
      if (!entityId) return;

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Calculate drop position in SVG coordinates
      const x = ((event.clientX - rect.left) / rect.width * viewBox.width + viewBox.x);
      const y = ((event.clientY - rect.top) / rect.height * viewBox.height + viewBox.y);

      // Snap to grid
      const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;

      // Validate position
      const isValid = await validatePosition(floorPlan.id, entityId, { x: snappedX, y: snappedY });
      if (!isValid) {
        throw new Error('Invalid entity position');
      }

      // Update entity position with optimistic UI
      await updateEntityPosition(floorPlan.id, entityId, { x: snappedX, y: snappedY });
      onEntityDrop(entityId, { x: snappedX, y: snappedY });

      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      monitorPerformance('Drop operation', performance.now() - startTime);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Drop operation failed'));
    }
  }, [floorPlan.id, viewBox, onEntityDrop, onError, updateEntityPosition, validatePosition]);

  // Set up gesture handling
  const bind = useGesture({
    onWheel: handleZoom,
    onDrag: handlePan,
    onDragStart: () => setIsDragging(true),
    onDragEnd: () => setIsDragging(false)
  }, {
    drag: {
      filterTaps: true,
      threshold: 5
    }
  });

  // Apply inertia animation
  useEffect(() => {
    if (viewBox.inertia > 0) {
      const animate = () => {
        setViewBox(prev => ({
          ...prev,
          x: prev.x + prev.inertia,
          y: prev.y + prev.inertia,
          inertia: prev.inertia * INERTIA_FACTOR
        }));
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [viewBox.inertia]);

  return (
    <ErrorBoundary
      fallback={<div>Error loading floor plan</div>}
      onError={onError}
    >
      <FloorPlanContainer
        ref={containerRef}
        className={className}
        isDragging={isDragging}
        isLoading={isLoading}
        onDragOver={event => event.preventDefault()}
        onDrop={handleDrop}
        {...bind()}
      >
        <SVGContainer
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Grid>
            {/* Render grid lines */}
            {Array.from({ length: Math.ceil(viewBox.width / GRID_SIZE) }).map((_, i) => (
              <line
                key={`vertical-${i}`}
                x1={i * GRID_SIZE}
                y1={0}
                x2={i * GRID_SIZE}
                y2={viewBox.height}
              />
            ))}
            {Array.from({ length: Math.ceil(viewBox.height / GRID_SIZE) }).map((_, i) => (
              <line
                key={`horizontal-${i}`}
                x1={0}
                y1={i * GRID_SIZE}
                x2={viewBox.width}
                y2={i * GRID_SIZE}
              />
            ))}
          </Grid>

          {/* Render floor plan SVG */}
          <g dangerouslySetInnerHTML={{ __html: floorPlan.svgData }} />

          {/* Render entity layer */}
          <EntityLayer>
            {children}
          </EntityLayer>
        </SVGContainer>

        {isLoading && (
          <LoadingOverlay>
            Loading floor plan...
          </LoadingOverlay>
        )}
      </FloorPlanContainer>
    </ErrorBoundary>
  );
};

export default React.memo(FloorPlan);
import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import styled from 'styled-components'; // v6.0.0
import { EntityIconProps } from './EntityIcon.types';
import Icon from '../../common/Icon/Icon';
import useDragDrop from '../../../hooks/useDragDrop';
import { IconType, IconSize } from '../../common/Icon/Icon.types';

// Constants for interaction timing
const LONG_PRESS_DURATION = 500;
const TAP_TIMEOUT = 300;
const DRAG_THRESHOLD = 5;

// Styled wrapper for the entity icon with theme support
const StyledEntityIcon = styled.div<{
  $position: { x: number; y: number; scale: number; rotation: number };
  $isPressed: boolean;
  $isDragging: boolean;
  $isActive: boolean;
}>`
  position: absolute;
  transform: translate3d(${p => p.$position.x}px, ${p => p.$position.y}px, 0)
    rotate(${p => p.$position.rotation}deg)
    scale(${p => p.$position.scale});
  cursor: move;
  user-select: none;
  touch-action: none;
  transition: transform 0.1s ease, opacity 0.2s ease, filter 0.2s ease;
  opacity: ${p => p.$isDragging ? 0.6 : 1};
  filter: brightness(${p => p.$isPressed ? 0.8 : 1});
  
  &:hover {
    filter: brightness(1.1);
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.colors.primary};
    outline-offset: 2px;
  }

  ${p => p.$isActive && `
    &::after {
      content: '';
      position: absolute;
      inset: -4px;
      border: 2px solid ${p.theme.colors.primary};
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
  `}

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.5; }
    100% { transform: scale(1); opacity: 1; }
  }
`;

/**
 * EntityIcon component for rendering interactive smart home device icons
 * Supports drag-and-drop positioning, tap/long-press interactions, and state visualization
 */
const EntityIcon: React.FC<EntityIconProps> = memo(({
  config,
  state,
  theme,
  onTap,
  onLongPress,
  onDragStart,
  onDragEnd
}) => {
  // State for interaction handling
  const [isPressed, setIsPressed] = useState(false);
  const pressTimer = useRef<number>();
  const tapTimer = useRef<number>();
  const startPos = useRef<{ x: number; y: number } | null>(null);

  // Initialize drag and drop functionality
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    isDragging,
    handleDragStart: startDrag,
    handleDragEnd: endDrag,
    currentPosition
  } = useDragDrop({
    containerRef,
    onPositionChange: (_, pos) => {
      if (onDragEnd) onDragEnd(pos);
    },
    enableScaling: true,
    boundaryPadding: 20
  });

  // Cleanup function for timers
  const cleanup = useCallback(() => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = undefined;
    }
    if (tapTimer.current) {
      window.clearTimeout(tapTimer.current);
      tapTimer.current = undefined;
    }
    setIsPressed(false);
    startPos.current = null;
  }, []);

  // Handle press start for long-press detection
  const handlePressStart = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    
    const point = 'touches' in event ? event.touches[0] : event;
    startPos.current = { x: point.clientX, y: point.clientY };
    
    setIsPressed(true);
    
    pressTimer.current = window.setTimeout(() => {
      if (onLongPress) {
        onLongPress(config.entity_id);
        cleanup();
      }
    }, LONG_PRESS_DURATION);
  }, [config.entity_id, onLongPress, cleanup]);

  // Handle press end and determine interaction type
  const handlePressEnd = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    
    const point = 'changedTouches' in event ? event.changedTouches[0] : event;
    
    if (startPos.current) {
      const deltaX = Math.abs(point.clientX - startPos.current.x);
      const deltaY = Math.abs(point.clientY - startPos.current.y);
      
      if (deltaX < DRAG_THRESHOLD && deltaY < DRAG_THRESHOLD) {
        tapTimer.current = window.setTimeout(() => {
          if (onTap) onTap(config.entity_id);
        }, TAP_TIMEOUT);
      }
    }
    
    cleanup();
  }, [config.entity_id, onTap, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Determine icon type and state-based styling
  const getIconName = useCallback(() => {
    const baseIcon = config.icon_override || config.type;
    const stateModifier = state === 'on' ? '-active' : '';
    return `${baseIcon}${stateModifier}`;
  }, [config.icon_override, config.type, state]);

  return (
    <StyledEntityIcon
      ref={containerRef}
      $position={currentPosition || config.position}
      $isPressed={isPressed}
      $isDragging={isDragging}
      $isActive={state === 'on'}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onDragStart={(e) => {
        e.preventDefault();
        if (onDragStart) onDragStart(config.entity_id);
        startDrag(e, config.entity_id);
      }}
      onDragEnd={(e) => {
        e.preventDefault();
        endDrag(e);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${config.display_name || config.entity_id} - ${state}`}
      data-testid={`entity-icon-${config.entity_id}`}
    >
      <Icon
        name={getIconName()}
        type={IconType.DEVICE}
        size={IconSize.MEDIUM}
        color={theme.colors.text}
        themeVariant={theme.mode}
        title={config.display_name || config.entity_id}
      />
    </StyledEntityIcon>
  );
});

EntityIcon.displayName = 'EntityIcon';

export default EntityIcon;
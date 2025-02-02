import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react'; // ^13.0.0
import { jest } from '@jest/globals'; // ^29.0.0
import { ThemeProvider } from 'styled-components'; // ^6.0.0
import EntityIcon from './EntityIcon';
import { EntityIconProps } from './EntityIcon.types';
import { useDragDrop } from '../../../hooks/useDragDrop';

// Mock the useDragDrop hook
jest.mock('../../../hooks/useDragDrop');

// Constants for testing
const LONG_PRESS_DURATION = 500;
const TAP_TIMEOUT = 300;

// Mock theme for testing
const mockTheme = {
  mode: 'light',
  colors: {
    primary: '#007AFF',
    background: '#FFFFFF',
    text: '#000000',
    success: '#34C759',
    error: '#FF3B30'
  }
};

// Mock entity configuration
const mockEntityConfig = {
  entity_id: 'light.living_room',
  type: 'LIGHT',
  position: { x: 100, y: 100, scale: 1, rotation: 0 },
  display_name: 'Living Room Light',
  icon_override: null,
  floor_id: 'ground',
  visible: true,
  custom_settings: {}
};

// Helper function to render component with theme
const renderWithTheme = (props: Partial<EntityIconProps> = {}) => {
  const defaultProps: EntityIconProps = {
    config: mockEntityConfig,
    state: 'off',
    theme: mockTheme,
    onTap: jest.fn(),
    onLongPress: jest.fn(),
    onDragStart: jest.fn(),
    onDragEnd: jest.fn()
  };

  return render(
    <ThemeProvider theme={mockTheme}>
      <EntityIcon {...defaultProps} {...props} />
    </ThemeProvider>
  );
};

describe('EntityIcon Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock useDragDrop implementation
    (useDragDrop as jest.Mock).mockReturnValue({
      isDragging: false,
      currentPosition: null,
      handleDragStart: jest.fn(),
      handleDragEnd: jest.fn(),
      dragRef: { current: null }
    });

    // Mock window timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders correctly with initial props', () => {
      const { container } = renderWithTheme();
      
      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('role', 'button');
      expect(icon).toHaveAttribute('aria-label', `${mockEntityConfig.display_name} - off`);
      
      // Verify position styles
      expect(icon).toHaveStyle(`
        transform: translate3d(100px, 100px, 0) rotate(0deg) scale(1)
      `);
    });

    it('applies correct theme styles', () => {
      const { container } = renderWithTheme();
      
      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      expect(icon).toHaveStyle(`
        cursor: move;
        user-select: none;
        touch-action: none;
      `);
    });

    it('renders with active state styles', () => {
      renderWithTheme({ state: 'on' });
      
      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      expect(icon).toHaveStyle('filter: brightness(1)');
      expect(icon).toHaveClass(/active/);
    });
  });

  describe('Interactions', () => {
    it('handles tap interaction correctly', async () => {
      const onTap = jest.fn();
      renderWithTheme({ onTap });

      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      fireEvent.mouseDown(icon);
      fireEvent.mouseUp(icon);

      // Wait for tap timeout
      jest.advanceTimersByTime(TAP_TIMEOUT);

      expect(onTap).toHaveBeenCalledWith(mockEntityConfig.entity_id);
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('handles long press interaction correctly', async () => {
      const onLongPress = jest.fn();
      renderWithTheme({ onLongPress });

      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      fireEvent.mouseDown(icon);

      // Wait for long press duration
      jest.advanceTimersByTime(LONG_PRESS_DURATION);

      expect(onLongPress).toHaveBeenCalledWith(mockEntityConfig.entity_id);
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('cancels long press on early release', () => {
      const onLongPress = jest.fn();
      renderWithTheme({ onLongPress });

      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      fireEvent.mouseDown(icon);
      
      // Release before long press duration
      jest.advanceTimersByTime(LONG_PRESS_DURATION - 100);
      fireEvent.mouseUp(icon);
      
      jest.advanceTimersByTime(100);
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('handles drag and drop interactions', () => {
      const onDragStart = jest.fn();
      const onDragEnd = jest.fn();
      const mockHandleDragStart = jest.fn();
      
      (useDragDrop as jest.Mock).mockReturnValue({
        isDragging: true,
        handleDragStart: mockHandleDragStart,
        handleDragEnd: jest.fn(),
        currentPosition: { x: 150, y: 150, scale: 1, rotation: 0 }
      });

      renderWithTheme({ onDragStart, onDragEnd });

      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      fireEvent.dragStart(icon);

      expect(onDragStart).toHaveBeenCalledWith(mockEntityConfig.entity_id);
      expect(mockHandleDragStart).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      renderWithTheme();
      
      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      expect(icon).toHaveAttribute('role', 'button');
      expect(icon).toHaveAttribute('tabIndex', '0');
      expect(icon).toHaveAttribute('aria-label', `${mockEntityConfig.display_name} - off`);
    });

    it('supports keyboard interaction', () => {
      const onTap = jest.fn();
      renderWithTheme({ onTap });

      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      fireEvent.keyDown(icon, { key: 'Enter' });
      fireEvent.keyUp(icon, { key: 'Enter' });

      expect(onTap).toHaveBeenCalledWith(mockEntityConfig.entity_id);
    });
  });

  describe('State Updates', () => {
    it('updates visual state when entity state changes', () => {
      const { rerender } = renderWithTheme({ state: 'off' });
      
      let icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      expect(icon).not.toHaveClass(/active/);

      rerender(
        <ThemeProvider theme={mockTheme}>
          <EntityIcon
            config={mockEntityConfig}
            state="on"
            theme={mockTheme}
            onTap={jest.fn()}
            onLongPress={jest.fn()}
            onDragStart={jest.fn()}
            onDragEnd={jest.fn()}
          />
        </ThemeProvider>
      );

      icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      expect(icon).toHaveClass(/active/);
    });

    it('handles position updates during drag', () => {
      (useDragDrop as jest.Mock).mockReturnValue({
        isDragging: true,
        currentPosition: { x: 200, y: 200, scale: 1, rotation: 0 },
        handleDragStart: jest.fn(),
        handleDragEnd: jest.fn()
      });

      renderWithTheme();
      
      const icon = screen.getByTestId(`entity-icon-${mockEntityConfig.entity_id}`);
      expect(icon).toHaveStyle(`
        transform: translate3d(200px, 200px, 0) rotate(0deg) scale(1)
      `);
    });
  });
});
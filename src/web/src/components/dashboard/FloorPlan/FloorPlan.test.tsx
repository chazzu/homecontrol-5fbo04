import React from 'react'; // v18.0.0
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // v13.4.0
import userEvent from '@testing-library/user-event'; // v14.4.3
import '@testing-library/jest-dom/extend-expect'; // v5.16.5
import { act } from 'react-dom/test-utils';

import FloorPlan from './FloorPlan';
import { FloorPlanProps } from './FloorPlan.types';
import { mockFloorPlans, mockEntityPlacements } from '../../../tests/mocks/floorPlans';
import { PERFORMANCE_THRESHOLDS } from '../../../config/constants';

// Mock performance.now() for consistent timing tests
const mockPerformanceNow = jest.spyOn(performance, 'now');
let currentTime = 0;
mockPerformanceNow.mockImplementation(() => currentTime);

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  currentTime += 16.67; // Simulate 60fps
  callback(currentTime);
  return 0;
};

// Mock WebGL context for performance testing
const mockWebGLContext = jest.fn();
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(mockWebGLContext);

// Mock gesture handlers
const mockOnEntityDrop = jest.fn();
const mockOnZoom = jest.fn();
const mockOnPan = jest.fn();
const mockOnStateUpdate = jest.fn();
const mockOnError = jest.fn();

describe('FloorPlan Component', () => {
  let defaultProps: FloorPlanProps;

  beforeEach(() => {
    defaultProps = {
      floorPlan: mockFloorPlans.get('ground-floor')!,
      onEntityDrop: mockOnEntityDrop,
      onZoom: mockOnZoom,
      onPan: mockOnPan,
      onStateUpdate: mockOnStateUpdate,
      onError: mockOnError,
      isLoading: false
    };

    // Reset mocks and timers
    jest.clearAllMocks();
    currentTime = 0;
  });

  it('should render floor plan with correct dimensions', () => {
    const { container } = render(<FloorPlan {...defaultProps} />);
    const svg = container.querySelector('svg');
    
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 800 600');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  });

  it('should render grid lines based on GRID_SIZE', () => {
    const { container } = render(<FloorPlan {...defaultProps} />);
    const gridLines = container.querySelectorAll('line');
    
    // Calculate expected number of grid lines
    const horizontalLines = Math.ceil(defaultProps.floorPlan.dimensions.height / 20);
    const verticalLines = Math.ceil(defaultProps.floorPlan.dimensions.width / 20);
    
    expect(gridLines).toHaveLength(horizontalLines + verticalLines);
  });

  it('should handle entity drop with grid snapping', async () => {
    const { container } = render(<FloorPlan {...defaultProps} />);
    
    const dropEvent = {
      clientX: 155, // Should snap to 160 (nearest grid)
      clientY: 145, // Should snap to 140 (nearest grid)
      preventDefault: jest.fn(),
      dataTransfer: {
        getData: jest.fn().mockReturnValue('light.living_room')
      }
    };

    await act(async () => {
      fireEvent.drop(container.firstChild!, dropEvent as unknown as React.DragEvent);
    });

    expect(mockOnEntityDrop).toHaveBeenCalledWith(
      'light.living_room',
      expect.objectContaining({
        x: 160,
        y: 140
      })
    );
  });

  it('should handle zoom gestures with performance monitoring', async () => {
    const { container } = render(<FloorPlan {...defaultProps} />);
    const startTime = performance.now();

    const wheelEvent = {
      deltaY: -100, // Zoom in
      preventDefault: jest.fn(),
      clientX: 400,
      clientY: 300
    };

    await act(async () => {
      fireEvent.wheel(container.firstChild!, wheelEvent);
    });

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxResponseTime);
    expect(mockOnZoom).toHaveBeenCalled();
  });

  it('should handle pan gestures with boundary constraints', async () => {
    const { container } = render(<FloorPlan {...defaultProps} />);
    
    await act(async () => {
      fireEvent.mouseDown(container.firstChild!, { clientX: 200, clientY: 200 });
      fireEvent.mouseMove(container.firstChild!, { clientX: 250, clientY: 250 });
      fireEvent.mouseUp(container.firstChild!);
    });

    expect(mockOnPan).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('should show loading overlay when isLoading is true', () => {
    render(<FloorPlan {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Loading floor plan...')).toBeInTheDocument();
  });

  it('should handle error boundary gracefully', () => {
    const errorProps = {
      ...defaultProps,
      floorPlan: {
        ...defaultProps.floorPlan,
        svgData: 'invalid-svg-data'
      }
    };

    render(<FloorPlan {...errorProps} />);
    expect(screen.getByText('Error loading floor plan')).toBeInTheDocument();
    expect(mockOnError).toHaveBeenCalled();
  });

  it('should maintain performance under heavy load', async () => {
    const heavyLoadProps = {
      ...defaultProps,
      floorPlan: mockFloorPlans.get('max-entities')!
    };

    const startTime = performance.now();
    const { container } = render(<FloorPlan {...heavyLoadProps} />);
    const renderTime = performance.now() - startTime;

    expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxResponseTime);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should handle multi-touch gestures correctly', async () => {
    const { container } = render(<FloorPlan {...defaultProps} />);
    
    const touchStart = new Touch({
      identifier: 0,
      target: container.firstChild as Element,
      clientX: 0,
      clientY: 0
    });

    const touchMove = new Touch({
      identifier: 0,
      target: container.firstChild as Element,
      clientX: 100,
      clientY: 100
    });

    await act(async () => {
      fireEvent.touchStart(container.firstChild!, {
        touches: [touchStart],
        targetTouches: [touchStart],
        changedTouches: [touchStart]
      });

      fireEvent.touchMove(container.firstChild!, {
        touches: [touchMove],
        targetTouches: [touchMove],
        changedTouches: [touchMove]
      });

      fireEvent.touchEnd(container.firstChild!, {
        touches: [],
        targetTouches: [],
        changedTouches: [touchMove]
      });
    });

    expect(mockOnPan).toHaveBeenCalled();
  });

  it('should validate entity positions within boundaries', async () => {
    const { container } = render(<FloorPlan {...defaultProps} />);
    
    // Attempt to drop entity outside boundaries
    const dropEvent = {
      clientX: -100,
      clientY: -100,
      preventDefault: jest.fn(),
      dataTransfer: {
        getData: jest.fn().mockReturnValue('light.test')
      }
    };

    await act(async () => {
      fireEvent.drop(container.firstChild!, dropEvent as unknown as React.DragEvent);
    });

    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Invalid entity position')
      })
    );
  });

  it('should handle window resize events', async () => {
    const { container, rerender } = render(<FloorPlan {...defaultProps} />);
    
    await act(async () => {
      global.innerWidth = 1024;
      global.innerHeight = 768;
      fireEvent(window, new Event('resize'));
    });

    rerender(<FloorPlan {...defaultProps} />);
    expect(container.querySelector('svg')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  });

  it('should cleanup resources on unmount', () => {
    const { unmount } = render(<FloorPlan {...defaultProps} />);
    
    unmount();
    expect(mockWebGLContext).toHaveBeenCalled();
  });
});
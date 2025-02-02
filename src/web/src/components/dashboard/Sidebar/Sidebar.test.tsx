import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from 'styled-components';
import Sidebar from './Sidebar';
import { useFloorPlan } from '../../../hooks/useFloorPlan';
import { useEntity } from '../../../hooks/useEntity';
import { lightTheme } from '../../../theme';
import { PERFORMANCE_THRESHOLDS } from '../../../config/constants';

// Mock the hooks
jest.mock('../../../hooks/useFloorPlan');
jest.mock('../../../hooks/useEntity');

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Helper function to render component with theme
const renderWithTheme = async (ui: React.ReactElement) => {
  const renderResult = render(
    <ThemeProvider theme={lightTheme}>
      {ui}
    </ThemeProvider>
  );
  
  const axeResults = await axe(renderResult.container);
  return {
    ...renderResult,
    axeResults
  };
};

describe('Sidebar Component', () => {
  // Mock data
  const mockFloorPlans = new Map([
    ['floor1', {
      id: 'floor1',
      name: 'Ground Floor',
      order: 0,
      svgData: '<svg></svg>',
      dimensions: { width: 800, height: 600, aspectRatio: 1.33 }
    }],
    ['floor2', {
      id: 'floor2',
      name: 'First Floor',
      order: 1,
      svgData: '<svg></svg>',
      dimensions: { width: 800, height: 600, aspectRatio: 1.33 }
    }]
  ]);

  const mockEntities = new Map([
    ['light.living_room', {
      entity_id: 'light.living_room',
      state: 'on',
      attributes: { friendly_name: 'Living Room Light' }
    }]
  ]);

  beforeEach(() => {
    // Reset mocks
    (useFloorPlan as jest.Mock).mockReturnValue({
      floorPlans: mockFloorPlans,
      activeFloorPlan: null,
      loading: false,
      error: null,
      setActiveFloorPlan: jest.fn()
    });

    (useEntity as jest.Mock).mockReturnValue({
      entities: mockEntities,
      loading: false,
      error: null
    });
  });

  it('renders without crashing and meets accessibility standards', async () => {
    const startTime = performance.now();
    const { axeResults } = await renderWithTheme(
      <Sidebar theme="light" initialCollapsed={false} />
    );

    // Verify render performance
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxResponseTime);

    // Verify accessibility
    expect(axeResults).toHaveNoViolations();

    // Verify basic structure
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard sidebar')).toBeInTheDocument();
  });

  it('handles responsive behavior and collapse state', async () => {
    const onCollapsedChange = jest.fn();
    const { container } = await renderWithTheme(
      <Sidebar 
        theme="light" 
        initialCollapsed={false}
        onCollapsedChange={onCollapsedChange}
      />
    );

    // Test collapse button
    const collapseButton = screen.getByLabelText('Collapse sidebar');
    await userEvent.click(collapseButton);

    // Verify collapse state change
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(collapseButton).toHaveAttribute('aria-label', 'Expand sidebar');

    // Verify responsive styles
    const sidebar = container.firstChild as HTMLElement;
    expect(sidebar).toHaveStyle({ width: '64px' });

    // Test mobile view
    window.innerWidth = 767;
    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      expect(sidebar).toHaveStyle({ width: '0' });
    });
  });

  it('manages floor plan list with loading and error states', async () => {
    // Test loading state
    (useFloorPlan as jest.Mock).mockReturnValue({
      floorPlans: new Map(),
      activeFloorPlan: null,
      loading: true,
      error: null
    });

    const { rerender } = await renderWithTheme(
      <Sidebar theme="light" initialCollapsed={false} />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Test error state
    (useFloorPlan as jest.Mock).mockReturnValue({
      floorPlans: new Map(),
      activeFloorPlan: null,
      loading: false,
      error: new Error('Failed to load floor plans')
    });

    rerender(
      <ThemeProvider theme={lightTheme}>
        <Sidebar theme="light" initialCollapsed={false} />
      </ThemeProvider>
    );

    expect(screen.getByText(/Failed to load floor plans/i)).toBeInTheDocument();

    // Test successful load
    (useFloorPlan as jest.Mock).mockReturnValue({
      floorPlans: mockFloorPlans,
      activeFloorPlan: 'floor1',
      loading: false,
      error: null,
      setActiveFloorPlan: jest.fn()
    });

    rerender(
      <ThemeProvider theme={lightTheme}>
        <Sidebar theme="light" initialCollapsed={false} />
      </ThemeProvider>
    );

    expect(screen.getByText('Ground Floor')).toBeInTheDocument();
    expect(screen.getByText('First Floor')).toBeInTheDocument();
  });

  it('handles entity drag-and-drop initialization', async () => {
    const { container } = await renderWithTheme(
      <Sidebar theme="light" initialCollapsed={false} />
    );

    const entityList = screen.getByRole('list');
    const entityItem = within(entityList).getByText('Living Room Light');

    // Verify draggable attributes
    expect(entityItem).toHaveAttribute('draggable', 'true');

    // Test drag start
    fireEvent.dragStart(entityItem);
    
    // Verify drag data
    const dragEvent = new DragEvent('dragstart', {
      dataTransfer: new DataTransfer()
    });
    fireEvent(entityItem, dragEvent);
    
    expect(dragEvent.dataTransfer?.getData('text/plain')).toBe('light.living_room');
    expect(entityItem).toHaveAttribute('aria-grabbed', 'true');
  });

  it('supports keyboard navigation', async () => {
    await renderWithTheme(
      <Sidebar theme="light" initialCollapsed={false} />
    );

    const floorPlanSection = screen.getByRole('button', { name: /floor plans/i });
    
    // Test keyboard interaction
    await userEvent.tab();
    expect(floorPlanSection).toHaveFocus();

    await userEvent.keyboard('{enter}');
    expect(screen.getByText('Ground Floor')).toBeVisible();

    // Test floor plan selection via keyboard
    const groundFloor = screen.getByText('Ground Floor');
    await userEvent.tab();
    expect(groundFloor).toHaveFocus();

    await userEvent.keyboard('{enter}');
    expect(groundFloor).toHaveAttribute('aria-selected', 'true');
  });

  it('maintains theme consistency', async () => {
    const { container } = await renderWithTheme(
      <Sidebar theme="dark" initialCollapsed={false} />
    );

    const sidebar = container.firstChild as HTMLElement;
    
    // Verify theme-specific styles
    expect(sidebar).toHaveStyle({
      background: lightTheme.colors.background,
      color: lightTheme.colors.text
    });

    // Test theme-specific hover states
    const floorPlanItem = screen.getByText('Ground Floor');
    fireEvent.mouseEnter(floorPlanItem);
    expect(floorPlanItem).toHaveStyle({
      background: `${lightTheme.colors.primary}10`
    });
  });
});
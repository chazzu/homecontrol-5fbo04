import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import Dashboard from './Dashboard';
import { mockEntityStates, mockEntityConfigs } from '../../../tests/mocks/entities';
import { mockFloorPlans, mockEntityPlacements } from '../../../tests/mocks/floorPlans';
import { FloorPlanContext } from '../../contexts/FloorPlanContext';
import { EntityContext } from '../../contexts/EntityContext';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// Mock contexts and providers
const mockFloorPlanContext = {
  floorPlans: mockFloorPlans,
  activeFloorPlan: mockFloorPlans.get('ground-floor'),
  loading: false,
  error: null,
  isSyncing: false,
  lastSyncTimestamp: Date.now(),
  setActiveFloorPlan: jest.fn(),
  createFloorPlan: jest.fn(),
  updateFloorPlan: jest.fn(),
  deleteFloorPlan: jest.fn(),
  updateEntityPlacement: jest.fn(),
  removeEntityPlacement: jest.fn(),
  syncState: jest.fn(),
  clearError: jest.fn()
};

const mockEntityContext = {
  entities: new Map(Object.entries(mockEntityStates)),
  configurations: new Map(Object.entries(mockEntityConfigs)),
  loading: false,
  error: null,
  connectionState: 'connected',
  lastUpdate: Date.now(),
  performanceMetrics: {
    lastUpdateLatency: 0,
    averageLatency: 0,
    updateCount: 0,
    errorCount: 0
  },
  getEntityState: jest.fn(),
  getEntityConfig: jest.fn(),
  updateEntityConfig: jest.fn(),
  sendCommand: jest.fn(),
  batchUpdate: jest.fn()
};

// Helper function to render Dashboard with providers
const renderDashboard = (
  floorPlanContextOverrides = {},
  entityContextOverrides = {}
) => {
  return render(
    <FloorPlanContext.Provider value={{ ...mockFloorPlanContext, ...floorPlanContextOverrides }}>
      <EntityContext.Provider value={{ ...mockEntityContext, ...entityContextOverrides }}>
        <Dashboard />
      </EntityContext.Provider>
    </FloorPlanContext.Provider>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Core Functionality', () => {
    test('renders dashboard layout correctly', () => {
      renderDashboard();
      
      expect(screen.getByRole('list', { name: /entity list/i })).toBeInTheDocument();
      expect(screen.getByTestId('floor-plan-view')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/connected/i);
    });

    test('displays active floor plan', () => {
      renderDashboard();
      const floorPlan = mockFloorPlans.get('ground-floor');
      
      expect(screen.getByText(floorPlan!.name)).toBeInTheDocument();
      expect(screen.getByTestId('floor-plan-svg')).toHaveAttribute('viewBox', 
        `0 0 ${floorPlan!.dimensions.width} ${floorPlan!.dimensions.height}`
      );
    });

    test('handles entity filtering', async () => {
      renderDashboard();
      const searchInput = screen.getByPlaceholderText(/search entities/i);
      
      await userEvent.type(searchInput, 'living');
      
      expect(screen.getByText('Living Room Light')).toBeInTheDocument();
      expect(screen.queryByText('Kitchen Switch')).not.toBeInTheDocument();
    });
  });

  describe('Entity Interactions', () => {
    test('handles entity drag and drop', async () => {
      renderDashboard();
      const entityItem = screen.getByTestId('entity-item-light.living_room');
      const floorPlanView = screen.getByTestId('floor-plan-view');
      
      fireEvent.dragStart(entityItem);
      fireEvent.drop(floorPlanView, {
        clientX: 200,
        clientY: 200,
        dataTransfer: {
          getData: () => 'light.living_room'
        }
      });

      expect(mockFloorPlanContext.updateEntityPlacement).toHaveBeenCalledWith(
        'ground-floor',
        'light.living_room',
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number)
        })
      );
    });

    test('updates entity state in real-time', async () => {
      const updatedState = {
        ...mockEntityStates['light.living_room'],
        state: 'off'
      };
      
      renderDashboard({}, {
        getEntityState: jest.fn().mockReturnValue(updatedState)
      });

      await waitFor(() => {
        expect(screen.getByTestId('entity-state-light.living_room')).toHaveTextContent('off');
      });
    });

    test('handles entity control commands', async () => {
      renderDashboard();
      const entityControl = screen.getByTestId('entity-control-light.living_room');
      
      await userEvent.click(entityControl);
      
      expect(mockEntityContext.sendCommand).toHaveBeenCalledWith(
        'light.living_room',
        'turn_off',
        expect.any(Object)
      );
    });
  });

  describe('Performance Monitoring', () => {
    test('maintains response time under threshold', async () => {
      const startTime = performance.now();
      renderDashboard();
      
      const entityItem = screen.getByTestId('entity-item-light.living_room');
      await userEvent.click(entityItem);
      
      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxResponseTime);
    });

    test('synchronizes state within latency requirements', async () => {
      const startTime = performance.now();
      
      renderDashboard();
      mockEntityContext.batchUpdate([{
        entityId: 'light.living_room',
        state: { ...mockEntityStates['light.living_room'], state: 'off' }
      }]);

      await waitFor(() => {
        const syncTime = performance.now() - startTime;
        expect(syncTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxSyncLatency);
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message on floor plan load failure', () => {
      renderDashboard({
        error: new Error('Failed to load floor plan')
      });
      
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load floor plan/i);
    });

    test('handles entity command failures gracefully', async () => {
      mockEntityContext.sendCommand.mockRejectedValueOnce(new Error('Command failed'));
      renderDashboard();
      
      const entityControl = screen.getByTestId('entity-control-light.living_room');
      await userEvent.click(entityControl);
      
      expect(screen.getByRole('alert')).toHaveTextContent(/command failed/i);
    });
  });

  describe('Accessibility', () => {
    test('supports keyboard navigation', async () => {
      renderDashboard();
      const entityList = screen.getByRole('list', { name: /entity list/i });
      
      await userEvent.tab();
      expect(entityList).toHaveFocus();
    });

    test('provides appropriate ARIA labels', () => {
      renderDashboard();
      
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Entity List');
    });
  });
});
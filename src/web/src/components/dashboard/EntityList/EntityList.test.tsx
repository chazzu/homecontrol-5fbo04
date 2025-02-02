import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { describe, test, expect, jest, beforeEach } from '@jest/globals'; // v29.0.0
import { measurePerformance } from 'jest-performance'; // v1.0.0

import EntityList from './EntityList';
import { EntityType } from '../../../types/entity.types';
import { PERFORMANCE_THRESHOLDS } from '../../../config/constants';

// Mock WebSocket service
jest.mock('../../../services/websocket', () => ({
  WebSocketService: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    subscribe: jest.fn(),
    sendMessage: jest.fn()
  }))
}));

// Mock entity context
jest.mock('../../../contexts/EntityContext', () => ({
  useEntityContext: () => ({
    getEntityState: jest.fn(),
    getEntityConfig: jest.fn(),
    performanceMetrics: {
      lastUpdateLatency: 50,
      averageLatency: 75
    }
  })
}));

// Test utilities
const createMockEntities = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    entity_id: `light.test_${i}`,
    type: EntityType.LIGHT,
    position: { x: 0, y: 0, scale: 1, rotation: 0 },
    floor_id: 'floor_1',
    visible: true,
    custom_settings: {},
    display_name: `Test Light ${i}`,
    icon_override: null
  }));
};

const setup = (props = {}) => {
  const defaultProps = {
    entities: createMockEntities(10),
    selectedType: null,
    searchQuery: '',
    onDragStart: jest.fn(),
    onSelect: jest.fn(),
    virtualized: true
  };

  return render(
    <EntityList {...defaultProps} {...props} />
  );
};

describe('EntityList Component', () => {
  describe('Core Functionality', () => {
    test('renders without crashing', () => {
      const { container } = setup();
      expect(container).toBeTruthy();
    });

    test('displays list of entities correctly', () => {
      const entities = createMockEntities(3);
      setup({ entities });

      entities.forEach(entity => {
        expect(screen.getByText(entity.display_name)).toBeInTheDocument();
      });
    });

    test('filters entities by type', async () => {
      const entities = [
        ...createMockEntities(2),
        {
          entity_id: 'switch.test',
          type: EntityType.SWITCH,
          position: { x: 0, y: 0, scale: 1, rotation: 0 },
          floor_id: 'floor_1',
          visible: true,
          custom_settings: {},
          display_name: 'Test Switch',
          icon_override: null
        }
      ];

      setup({
        entities,
        selectedType: EntityType.LIGHT
      });

      expect(screen.queryByText('Test Switch')).not.toBeInTheDocument();
      expect(screen.getAllByTestId(/^entity-item-light/)).toHaveLength(2);
    });

    test('filters entities by search query', () => {
      const entities = createMockEntities(5);
      setup({
        entities,
        searchQuery: 'Test Light 1'
      });

      expect(screen.getByText('Test Light 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Light 4')).not.toBeInTheDocument();
    });

    test('handles drag start events', async () => {
      const onDragStart = jest.fn();
      const entities = createMockEntities(1);
      setup({ entities, onDragStart });

      const entityItem = screen.getByTestId('entity-item-light.test_0');
      fireEvent.dragStart(entityItem);

      expect(onDragStart).toHaveBeenCalledWith(
        entities[0],
        expect.any(Object)
      );
    });

    test('updates entity selection', () => {
      const onSelect = jest.fn();
      const entities = createMockEntities(2);
      setup({ entities, onSelect });

      const entityItem = screen.getByTestId('entity-item-light.test_0');
      fireEvent.click(entityItem);

      expect(onSelect).toHaveBeenCalledWith(entities[0]);
    });
  });

  describe('Virtualization', () => {
    test('renders virtualized list correctly', async () => {
      const entities = createMockEntities(1000);
      const { container } = setup({ entities });

      // Check that not all entities are rendered initially
      const renderedItems = container.querySelectorAll('[data-testid^="entity-item-"]');
      expect(renderedItems.length).toBeLessThan(entities.length);
    });

    test('maintains performance with 1000+ entities', async () => {
      const entities = createMockEntities(1000);
      
      const { result, duration } = await measurePerformance(() => {
        setup({ entities });
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxResponseTime);
    });

    test('handles scroll events efficiently', async () => {
      const entities = createMockEntities(1000);
      const { container } = setup({ entities });

      const virtualList = container.querySelector('[role="list"]');
      expect(virtualList).toBeTruthy();

      await waitFor(() => {
        fireEvent.scroll(virtualList!, { target: { scrollTop: 500 } });
      });

      // Verify that new items are rendered after scrolling
      expect(screen.queryByText('Test Light 20')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    test('reflects entity state changes', async () => {
      const entities = createMockEntities(1);
      const { rerender } = setup({ entities });

      // Simulate state update
      const updatedEntities = [...entities];
      updatedEntities[0] = { ...entities[0], display_name: 'Updated Light' };

      rerender(
        <EntityList
          entities={updatedEntities}
          selectedType={null}
          searchQuery=""
          onDragStart={jest.fn()}
          onSelect={jest.fn()}
          virtualized={true}
        />
      );

      expect(screen.getByText('Updated Light')).toBeInTheDocument();
    });

    test('maintains update latency under 200ms', async () => {
      const entities = createMockEntities(100);
      const { rerender } = setup({ entities });

      const startTime = performance.now();

      // Simulate multiple rapid updates
      for (let i = 0; i < 5; i++) {
        const updatedEntities = entities.map(e => ({ ...e }));
        rerender(
          <EntityList
            entities={updatedEntities}
            selectedType={null}
            searchQuery=""
            onDragStart={jest.fn()}
            onSelect={jest.fn()}
            virtualized={true}
          />
        );
      }

      const updateTime = performance.now() - startTime;
      expect(updateTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxSyncLatency);
    });
  });

  describe('Accessibility', () => {
    test('provides correct ARIA attributes', () => {
      setup();
      
      const list = screen.getByRole('list');
      expect(list).toHaveAttribute('aria-label', 'Entity List');

      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toHaveAttribute('aria-label', 'Search entities');
    });

    test('supports keyboard navigation', async () => {
      const entities = createMockEntities(3);
      const onSelect = jest.fn();
      setup({ entities, onSelect });

      const firstItem = screen.getByTestId('entity-item-light.test_0');
      firstItem.focus();

      await userEvent.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledWith(entities[0]);

      await userEvent.keyboard('{Tab}');
      const secondItem = screen.getByTestId('entity-item-light.test_1');
      expect(secondItem).toHaveFocus();
    });

    test('maintains focus management', async () => {
      const entities = createMockEntities(3);
      setup({ entities });

      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'Test');

      expect(searchInput).toHaveFocus();
      expect(screen.getAllByTestId(/^entity-item-/)).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    test('handles invalid entity data', () => {
      const invalidEntities = [
        { ...createMockEntities(1)[0], entity_id: undefined }
      ];
      
      // Should not crash with invalid data
      setup({ entities: invalidEntities as any });
      
      expect(screen.queryByTestId(/^entity-item-/)).not.toBeInTheDocument();
    });

    test('displays error states', () => {
      const entities = createMockEntities(1).map(e => ({
        ...e,
        error: 'Connection lost'
      }));

      setup({ entities });

      expect(screen.getByText('unavailable')).toBeInTheDocument();
    });
  });
});
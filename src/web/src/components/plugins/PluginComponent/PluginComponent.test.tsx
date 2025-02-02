import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';

import PluginComponent from './PluginComponent';
import { usePlugin } from '../../../hooks/usePlugin';
import { PluginState, PluginType } from '../../../types/plugin.types';
import { EntityType } from '../../../types/entity.types';

// Mock usePlugin hook
jest.mock('../../../hooks/usePlugin');
const mockUsePlugin = usePlugin as jest.MockedFunction<typeof usePlugin>;

// Mock performance API
jest.mock('perf_hooks', () => ({
  performance: {
    now: jest.fn(),
    memory: {
      usedJSHeapSize: 0
    }
  }
}));

// Test constants
const PERFORMANCE_CONFIG = {
  LOAD_TIMEOUT: 500,
  MEMORY_LIMIT: 50 * 1024 * 1024,
  RENDER_THRESHOLD: 16
};

// Mock plugin manifest
const mockManifest = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  type: PluginType.ENTITY_COMPONENT,
  entryPoint: '/plugins/test-plugin.js',
  description: 'Test plugin for unit tests',
  author: 'Test Author'
};

// Mock entity configuration
const mockEntityConfig = {
  entity_id: 'light.test_light',
  type: EntityType.LIGHT,
  position: { x: 0, y: 0, scale: 1, rotation: 0 },
  floor_id: 'floor-1',
  visible: true,
  custom_settings: {},
  display_name: null,
  icon_override: null
};

// Helper function to setup plugin context
const setupPluginContext = () => {
  const loadPlugin = jest.fn();
  const unloadPlugin = jest.fn();
  const validatePlugin = jest.fn().mockReturnValue(true);
  const getPluginComponent = jest.fn();
  const isPluginActive = jest.fn().mockReturnValue(true);
  const getPluginMetrics = jest.fn();

  mockUsePlugin.mockReturnValue({
    loadPlugin,
    unloadPlugin,
    validatePlugin,
    getPluginComponent,
    isPluginActive,
    getPluginMetrics,
    plugins: new Map(),
    pluginStates: new Map(),
    hasPlugin: jest.fn(),
    getPluginErrors: jest.fn()
  });

  return {
    loadPlugin,
    unloadPlugin,
    validatePlugin,
    getPluginComponent,
    isPluginActive,
    getPluginMetrics
  };
};

describe('PluginComponent', () => {
  // Setup and teardown
  beforeEach(() => {
    jest.useFakeTimers();
    (performance.now as jest.Mock).mockReturnValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Plugin Loading', () => {
    it('verifies plugin load time is under 500ms', async () => {
      const { loadPlugin } = setupPluginContext();
      const startTime = 0;
      const endTime = 400;
      
      (performance.now as jest.Mock)
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(endTime);

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(loadPlugin).toHaveBeenCalledWith(
          mockManifest,
          expect.objectContaining({
            validateManifest: true,
            timeout: PERFORMANCE_CONFIG.LOAD_TIMEOUT
          })
        );
      });

      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(PERFORMANCE_CONFIG.LOAD_TIMEOUT);
    });

    it('handles plugin load timeout gracefully', async () => {
      const { loadPlugin } = setupPluginContext();
      const onError = jest.fn();
      
      loadPlugin.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, PERFORMANCE_CONFIG.LOAD_TIMEOUT + 100);
        });
      });

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={onError}
        />
      );

      act(() => {
        jest.advanceTimersByTime(PERFORMANCE_CONFIG.LOAD_TIMEOUT + 100);
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'RUNTIME_ERROR',
            pluginId: mockManifest.id
          })
        );
      });
    });
  });

  describe('Plugin Security', () => {
    it('validates plugin manifest before loading', async () => {
      const { validatePlugin, loadPlugin } = setupPluginContext();

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(validatePlugin).toHaveBeenCalledWith(mockManifest);
        expect(loadPlugin).toHaveBeenCalled();
      });
    });

    it('prevents loading of invalid plugins', async () => {
      const { validatePlugin, loadPlugin } = setupPluginContext();
      const onError = jest.fn();
      
      validatePlugin.mockReturnValue(false);

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(loadPlugin).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'RUNTIME_ERROR',
            message: 'Invalid plugin manifest'
          })
        );
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('monitors memory usage during plugin lifecycle', async () => {
      const { getPluginMetrics } = setupPluginContext();
      const memoryUsage = 25 * 1024 * 1024; // 25MB
      
      (performance.memory as { usedJSHeapSize: number }).usedJSHeapSize = memoryUsage;

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(getPluginMetrics).toHaveBeenCalledWith(mockManifest.id);
      });

      expect(memoryUsage).toBeLessThan(PERFORMANCE_CONFIG.MEMORY_LIMIT);
    });

    it('tracks render performance', async () => {
      setupPluginContext();
      const startTime = 0;
      const endTime = 10; // 10ms render time
      
      (performance.now as jest.Mock)
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(endTime);

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={jest.fn()}
        />
      );

      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(PERFORMANCE_CONFIG.RENDER_THRESHOLD);
    });
  });

  describe('Plugin Lifecycle', () => {
    it('handles plugin state changes correctly', async () => {
      const { loadPlugin } = setupPluginContext();
      const onStateChange = jest.fn();

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={jest.fn()}
          onStateChange={onStateChange}
        />
      );

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith(PluginState.ACTIVE);
      });

      expect(loadPlugin).toHaveBeenCalled();
    });

    it('cleans up resources on unmount', async () => {
      const { unloadPlugin } = setupPluginContext();
      const { unmount } = render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={jest.fn()}
        />
      );

      unmount();

      await waitFor(() => {
        expect(unloadPlugin).toHaveBeenCalledWith(mockManifest.id);
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error state on plugin failure', async () => {
      const { loadPlugin } = setupPluginContext();
      const error = new Error('Plugin load failed');
      
      loadPlugin.mockRejectedValue(error);

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          `Plugin Error: ${mockManifest.name}`
        );
      });
    });

    it('handles runtime errors gracefully', async () => {
      const { getPluginComponent } = setupPluginContext();
      const onError = jest.fn();
      
      getPluginComponent.mockImplementation(() => {
        throw new Error('Runtime error');
      });

      render(
        <PluginComponent
          manifest={mockManifest}
          entityType={EntityType.LIGHT}
          entityConfig={mockEntityConfig}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'RUNTIME_ERROR',
            message: 'Runtime error'
          })
        );
      });
    });
  });
});
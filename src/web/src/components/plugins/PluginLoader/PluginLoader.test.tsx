import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PluginLoader } from './PluginLoader';
import { mockPluginManifests, mockPluginLoadErrors } from '../../../tests/mocks/plugins';
import { PluginState, PluginLoadError } from '../../../types/plugin.types';

// Mock performance.now() for consistent timing tests
const mockPerformanceNow = jest.fn();
global.performance.now = mockPerformanceNow;

// Mock console methods for clean test output
const originalConsole = { ...console };
beforeEach(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
  mockPerformanceNow.mockReturnValue(0);
});

afterEach(() => {
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  jest.clearAllMocks();
});

// Test utilities
const createTestProps = (overrides = {}) => ({
  manifest: mockPluginManifests[0],
  onLoad: jest.fn(),
  onError: jest.fn(),
  loadTimeout: 500,
  ...overrides
});

describe('PluginLoader Component', () => {
  describe('Plugin Loading', () => {
    it('should render loading state initially', () => {
      const props = createTestProps();
      render(<PluginLoader {...props} />);

      expect(screen.getByRole('alert')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(`Loading plugin ${props.manifest.name}`)).toBeInTheDocument();
    });

    it('should successfully load valid plugin within timeout', async () => {
      const props = createTestProps();
      mockPerformanceNow
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(100);

      render(<PluginLoader {...props} />);

      await waitFor(() => {
        expect(props.onLoad).toHaveBeenCalledWith(
          props.manifest,
          100 // load time
        );
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('region')).toHaveAttribute('data-plugin-id', props.manifest.id);
    });

    it('should handle multiple concurrent plugin loads', async () => {
      const plugins = mockPluginManifests.slice(0, 2);
      const loadPromises = plugins.map(manifest => {
        const props = createTestProps({ manifest });
        const { rerender } = render(<PluginLoader {...props} />);
        return waitFor(() => {
          expect(props.onLoad).toHaveBeenCalled();
          rerender(<PluginLoader {...props} />);
        });
      });

      await Promise.all(loadPromises);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track and report plugin load time', async () => {
      const props = createTestProps();
      mockPerformanceNow
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(600); // Exceeds 500ms threshold

      render(<PluginLoader {...props} />);

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('load time exceeded threshold')
        );
      });
    });

    it('should include performance metrics in successful load callback', async () => {
      const props = createTestProps();
      const loadTime = 250;
      mockPerformanceNow
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(loadTime);

      render(<PluginLoader {...props} />);

      await waitFor(() => {
        expect(props.onLoad).toHaveBeenCalledWith(
          expect.anything(),
          loadTime
        );
      });

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('data-load-time', String(loadTime));
    });
  });

  describe('Security Validation', () => {
    it('should validate plugin manifest before loading', async () => {
      const invalidManifest = { ...mockPluginManifests[0], id: '' };
      const props = createTestProps({ manifest: invalidManifest });

      render(<PluginLoader {...props} />);

      await waitFor(() => {
        expect(props.onError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MANIFEST_INVALID'
          })
        );
      });
    });

    it('should prevent loading of malicious plugins', async () => {
      const maliciousManifest = {
        ...mockPluginManifests[0],
        entryPoint: 'javascript:alert(1)'
      };
      const props = createTestProps({ manifest: maliciousManifest });

      render(<PluginLoader {...props} />);

      await waitFor(() => {
        expect(props.onError).toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to load plugin/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle load timeout gracefully', async () => {
      const props = createTestProps({ loadTimeout: 100 });
      mockPerformanceNow
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(150); // Exceeds timeout

      render(<PluginLoader {...props} />);

      await waitFor(() => {
        expect(props.onError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'LOAD_TIMEOUT'
          })
        );
      });
    });

    it('should implement retry mechanism for failed loads', async () => {
      const props = createTestProps();
      const error = new Error('Network error');
      jest.spyOn(global, 'setTimeout');

      render(<PluginLoader {...props} />);

      await waitFor(() => {
        expect(setTimeout).toHaveBeenCalledTimes(3); // 3 retry attempts
        expect(props.onError).toHaveBeenCalled();
      });
    });

    it('should display detailed error information in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const props = createTestProps();
      const error: PluginLoadError = mockPluginLoadErrors.RUNTIME_ERROR;
      props.onError.mockImplementation(() => {
        throw error;
      });

      render(<PluginLoader {...props} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(error.message);
        expect(screen.getByText(JSON.stringify(error.details, null, 2))).toBeInTheDocument();
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Lifecycle Management', () => {
    it('should cleanup resources on unmount', async () => {
      const props = createTestProps();
      const { unmount } = render(<PluginLoader {...props} />);

      unmount();

      expect(mockPerformanceNow).toHaveBeenCalled();
      // Additional cleanup verification would go here
    });

    it('should handle state updates properly', async () => {
      const props = createTestProps();
      const { rerender } = render(<PluginLoader {...props} />);

      // Test state transitions
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveAttribute('aria-busy', 'true');
      });

      const updatedProps = {
        ...props,
        manifest: { ...props.manifest, version: '1.1.0' }
      };

      rerender(<PluginLoader {...updatedProps} />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toHaveAttribute('data-plugin-id', props.manifest.id);
      });
    });
  });
});
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Settings } from './Settings';
import { ThemeContext } from '../../contexts/ThemeContext';
import { PluginContext } from '../../contexts/PluginContext';
import { SettingsTabId } from './Settings.types';
import { ThemeMode } from '../../types/theme.types';
import { PluginState, PluginType } from '../../types/plugin.types';

// Mock lazy-loaded components
jest.mock('./tabs/AppearanceTab', () => ({
  __esModule: true,
  default: () => <div data-testid="appearance-tab">Appearance Tab</div>
}));

jest.mock('./tabs/PluginsTab', () => ({
  __esModule: true,
  default: () => <div data-testid="plugins-tab">Plugins Tab</div>
}));

jest.mock('./tabs/AdvancedTab', () => ({
  __esModule: true,
  default: () => <div data-testid="advanced-tab">Advanced Tab</div>
}));

// Mock theme context values
const mockThemeContext = {
  theme: {
    mode: ThemeMode.LIGHT,
    colors: {
      background: '#FFFFFF',
      text: '#000000',
      primary: '#007AFF',
      secondary: '#5856D6',
      border: '#C7C7CC',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30'
    }
  },
  setTheme: jest.fn(),
  toggleTheme: jest.fn()
};

// Mock plugin context values
const mockPluginContext = {
  plugins: new Map(),
  pluginStates: new Map(),
  pluginMetrics: new Map(),
  pluginErrors: new Map(),
  loadPlugin: jest.fn(),
  unloadPlugin: jest.fn(),
  getPluginMetrics: jest.fn(),
  isPluginActive: jest.fn()
};

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    themeProviderProps = mockThemeContext,
    pluginProviderProps = mockPluginContext,
    ...renderOptions
  } = {}
) => {
  return render(
    <ThemeContext.Provider value={themeProviderProps}>
      <PluginContext.Provider value={pluginProviderProps}>
        {ui}
      </PluginContext.Provider>
    </ThemeContext.Provider>,
    renderOptions
  );
};

describe('Settings Component', () => {
  const defaultProps = {
    activeTab: SettingsTabId.APPEARANCE,
    onTabChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderWithProviders(<Settings {...defaultProps} />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('renders all tab buttons', () => {
      renderWithProviders(<Settings {...defaultProps} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('applies correct ARIA attributes', () => {
      renderWithProviders(<Settings {...defaultProps} />);
      const activeTab = screen.getByRole('tab', { selected: true });
      expect(activeTab).toHaveAttribute('aria-selected', 'true');
      expect(activeTab).toHaveAttribute('aria-controls', `${defaultProps.activeTab}-panel`);
    });
  });

  describe('Theme Management', () => {
    it('displays current theme mode', () => {
      renderWithProviders(<Settings {...defaultProps} />);
      expect(screen.getByRole('main')).toHaveStyle({
        backgroundColor: 'var(--color-background)'
      });
    });

    it('handles theme toggle', async () => {
      const toggleTheme = jest.fn();
      renderWithProviders(
        <Settings {...defaultProps} />,
        {
          themeProviderProps: { ...mockThemeContext, toggleTheme }
        }
      );
      
      await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
      expect(screen.getByTestId('appearance-tab')).toBeInTheDocument();
    });
  });

  describe('Plugin Management', () => {
    const mockPlugin = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      type: PluginType.ENTITY_COMPONENT,
      entryPoint: './test-plugin.js',
      description: 'Test plugin description',
      author: 'Test Author'
    };

    beforeEach(() => {
      mockPluginContext.plugins.set(mockPlugin.id, mockPlugin);
      mockPluginContext.pluginStates.set(mockPlugin.id, PluginState.ACTIVE);
    });

    it('displays active plugins', async () => {
      renderWithProviders(
        <Settings activeTab={SettingsTabId.PLUGINS} onTabChange={jest.fn()} />
      );
      expect(screen.getByTestId('plugins-tab')).toBeInTheDocument();
    });

    it('handles plugin loading errors', async () => {
      const loadError = new Error('Plugin load failed');
      mockPluginContext.loadPlugin.mockRejectedValueOnce(loadError);

      renderWithProviders(
        <Settings activeTab={SettingsTabId.PLUGINS} onTabChange={jest.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('plugins-tab')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('changes active tab on click', async () => {
      const onTabChange = jest.fn();
      renderWithProviders(<Settings {...defaultProps} onTabChange={onTabChange} />);

      await userEvent.click(screen.getByRole('tab', { name: /plugins/i }));
      expect(onTabChange).toHaveBeenCalledWith(SettingsTabId.PLUGINS);
    });

    it('loads tab content asynchronously', async () => {
      renderWithProviders(<Settings {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('renders efficiently without unnecessary updates', () => {
      const { rerender } = renderWithProviders(<Settings {...defaultProps} />);
      
      // Re-render with same props
      rerender(<Settings {...defaultProps} />);
      expect(mockThemeContext.setTheme).not.toHaveBeenCalled();
    });

    it('handles concurrent tab switches correctly', async () => {
      const onTabChange = jest.fn();
      renderWithProviders(<Settings {...defaultProps} onTabChange={onTabChange} />);

      const tabs = screen.getAllByRole('tab');
      await Promise.all([
        userEvent.click(tabs[1]),
        userEvent.click(tabs[2])
      ]);

      expect(onTabChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('displays error boundary for tab load failures', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Tab load failed');
      
      jest.mock('./tabs/AppearanceTab', () => {
        throw error;
      });

      renderWithProviders(<Settings {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });

    it('handles theme context errors gracefully', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      renderWithProviders(
        <Settings {...defaultProps} />,
        {
          themeProviderProps: { ...mockThemeContext, setTheme: null }
        }
      );

      expect(screen.getByRole('main')).toBeInTheDocument();
      consoleError.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('maintains focus management during tab switching', async () => {
      renderWithProviders(<Settings {...defaultProps} />);
      
      const firstTab = screen.getByRole('tab', { name: /appearance/i });
      const secondTab = screen.getByRole('tab', { name: /plugins/i });

      await userEvent.tab();
      expect(firstTab).toHaveFocus();

      await userEvent.keyboard('{arrowright}');
      expect(secondTab).toHaveFocus();
    });

    it('announces theme changes', async () => {
      const mockAnnouncement = jest.fn();
      window.speechSynthesis = {
        speak: mockAnnouncement
      } as unknown as SpeechSynthesis;

      renderWithProviders(<Settings {...defaultProps} />);
      
      await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
      mockThemeContext.toggleTheme();

      expect(mockAnnouncement).toHaveBeenCalled();
    });
  });
});
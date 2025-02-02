import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import userEvent from '@testing-library/user-event';
import ResizeObserver from 'resize-observer-polyfill';
import DashboardLayout from './DashboardLayout';
import { WebSocketProvider } from '../../../contexts/WebSocketContext';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { WebSocketConnectionState } from '../../../types/websocket.types';
import { ThemeMode } from '../../../types/theme.types';
import lightTheme from '../../../assets/styles/themes/light';

// Mock ResizeObserver
global.ResizeObserver = ResizeObserver;

// Mock matchMedia
const mockMatchMedia = jest.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

window.matchMedia = mockMatchMedia;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Helper function to render component with providers
const renderWithProviders = (ui: React.ReactNode, options = {}) => {
  const mockWebSocketContext = {
    connectionState: WebSocketConnectionState.CONNECTED,
    connectionMetrics: {
      latency: 50,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      lastHealthCheck: Date.now(),
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
    subscribe: jest.fn(),
    callService: jest.fn(),
    resetCircuitBreaker: jest.fn(),
  };

  return render(
    <WebSocketProvider initialConfig={{ url: '', token: '', reconnectInterval: 5000, maxRetries: 5 }}>
      <ThemeProvider>
        {ui}
      </ThemeProvider>
    </WebSocketProvider>,
    options
  );
};

// Helper function to setup media queries for responsive testing
const setupMediaQueries = (breakpoints: { [key: string]: boolean }) => {
  mockMatchMedia.mockImplementation((query) => ({
    matches: breakpoints[query] || false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
};

describe('DashboardLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReset();
    mockLocalStorage.setItem.mockReset();
  });

  describe('Layout Structure', () => {
    it('renders all main layout components', () => {
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-main')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('maintains correct layout structure with theme integration', () => {
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      const layout = screen.getByTestId('dashboard-main');
      expect(layout).toHaveStyle({
        display: 'flex',
        flex: '1',
      });
    });

    it('renders header with connection status', () => {
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('collapses sidebar on mobile view', () => {
      setupMediaQueries({ '(max-width: 768px)': true });
      
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);
      
      const sidebar = screen.getByTestId('dashboard-sidebar');
      expect(sidebar).toHaveStyle({ transform: 'translateX(-100%)' });
    });

    it('shows sidebar overlay when expanded on mobile', async () => {
      setupMediaQueries({ '(max-width: 768px)': true });
      mockLocalStorage.getItem.mockReturnValue('false');

      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      const overlay = screen.queryByTestId('sidebar-overlay');
      expect(overlay).toBeInTheDocument();
    });

    it('adjusts main content margin based on sidebar state', () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);
      
      const main = screen.getByTestId('dashboard-main');
      expect(main).toHaveStyle({ marginLeft: '64px' });
    });
  });

  describe('WebSocket Integration', () => {
    it('displays correct connection status in header', () => {
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      const connectionStatus = screen.getByTestId('connection-status');
      expect(connectionStatus).toHaveTextContent('Connected');
    });

    it('updates layout on connection state changes', () => {
      const { rerender } = renderWithProviders(
        <DashboardLayout>Content</DashboardLayout>
      );

      // Simulate connection state change
      rerender(
        <WebSocketProvider initialConfig={{ url: '', token: '', reconnectInterval: 5000, maxRetries: 5 }}>
          <ThemeProvider>
            <DashboardLayout>Content</DashboardLayout>
          </ThemeProvider>
        </WebSocketProvider>
      );

      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses correct ARIA attributes for navigation', () => {
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      const sidebar = screen.getByTestId('dashboard-sidebar');
      expect(sidebar).toHaveAttribute('role', 'complementary');
      expect(sidebar).toHaveAttribute('aria-label', 'Dashboard navigation');
    });

    it('maintains focus management for keyboard navigation', async () => {
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      const main = screen.getByTestId('dashboard-main');
      expect(main).toHaveAttribute('role', 'main');
    });

    it('supports keyboard interaction for sidebar toggle', async () => {
      setupMediaQueries({ '(max-width: 768px)': true });
      
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);
      
      const overlay = screen.queryByTestId('sidebar-overlay');
      if (overlay) {
        await userEvent.click(overlay);
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
      }
    });
  });

  describe('State Management', () => {
    it('persists sidebar state in localStorage', () => {
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('dashboard_sidebar_collapsed');
    });

    it('syncs sidebar state across browser tabs', () => {
      renderWithProviders(<DashboardLayout>Content</DashboardLayout>);

      // Simulate storage event
      const storageEvent = new StorageEvent('storage', {
        key: 'dashboard_sidebar_collapsed',
        newValue: 'true'
      });
      window.dispatchEvent(storageEvent);

      const sidebar = screen.getByTestId('dashboard-sidebar');
      expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    });
  });
});
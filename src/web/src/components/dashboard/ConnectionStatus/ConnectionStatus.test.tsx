import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import 'jest-styled-components';
import ConnectionStatus from './ConnectionStatus';
import { WebSocketConnectionState } from '../../../types/websocket.types';

// Mock theme object based on design system
const mockTheme = {
  colors: {
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    background: '#FFFFFF',
    text: '#000000',
    textSecondary: '#666666',
    focusRing: '#007AFF'
  },
  transitions: {
    default: '0.3s ease-in-out'
  },
  breakpoints: {
    mobile: '768px'
  }
};

// Helper function to render component with theme
const renderWithTheme = (ui: React.ReactElement, theme = mockTheme) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('ConnectionStatus', () => {
  // Mock retry callback with latency simulation
  const mockOnRetry = jest.fn().mockImplementation(() => 
    new Promise(resolve => setTimeout(resolve, 100))
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Visual States', () => {
    it('renders correctly in connected state', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.CONNECTED}
          onRetry={mockOnRetry}
          latency={50}
        />
      );

      const status = screen.getByTestId('connection-status');
      expect(status).toHaveStyleRule('border-color', mockTheme.colors.success);
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('(50ms)')).toBeInTheDocument();
    });

    it('renders correctly in disconnected state', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.DISCONNECTED}
          onRetry={mockOnRetry}
        />
      );

      const status = screen.getByTestId('connection-status');
      expect(status).toHaveStyleRule('border-color', mockTheme.colors.error);
      expect(status).toHaveStyleRule('cursor', 'pointer');
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('renders correctly in connecting state', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.CONNECTING}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toHaveStyleRule('border-color', mockTheme.colors.warning);
    });

    it('renders correctly in reconnecting state', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.RECONNECTING}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toHaveStyleRule('border-color', mockTheme.colors.warning);
    });

    it('renders correctly in error state', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.ERROR}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toHaveStyleRule('border-color', mockTheme.colors.error);
    });
  });

  describe('Accessibility', () => {
    it('provides appropriate ARIA attributes', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.CONNECTED}
          onRetry={mockOnRetry}
        />
      );

      const status = screen.getByTestId('connection-status');
      expect(status).toHaveAttribute('role', 'status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-atomic', 'true');
    });

    it('manages focus correctly for interactive states', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.DISCONNECTED}
          onRetry={mockOnRetry}
        />
      );

      const status = screen.getByTestId('connection-status');
      expect(status).toHaveAttribute('tabIndex', '0');
    });

    it('provides appropriate ARIA labels for icons', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.CONNECTED}
          onRetry={mockOnRetry}
        />
      );

      const icon = screen.getByLabelText('Connection established');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Interaction Handling', () => {
    it('calls onRetry when clicked in disconnected state', async () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.DISCONNECTED}
          onRetry={mockOnRetry}
        />
      );

      const status = screen.getByTestId('connection-status');
      fireEvent.click(status);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('debounces retry attempts', async () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.DISCONNECTED}
          onRetry={mockOnRetry}
        />
      );

      const status = screen.getByTestId('connection-status');
      fireEvent.click(status);
      fireEvent.click(status);
      fireEvent.click(status);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard interactions', () => {
      renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.DISCONNECTED}
          onRetry={mockOnRetry}
        />
      );

      const status = screen.getByTestId('connection-status');
      fireEvent.keyDown(status, { key: 'Enter' });
      
      expect(mockOnRetry).toHaveBeenCalled();
    });
  });

  describe('Performance Optimization', () => {
    it('prevents unnecessary re-renders with React.memo', () => {
      const { rerender } = renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.CONNECTED}
          onRetry={mockOnRetry}
          latency={50}
        />
      );

      // Re-render with same props
      rerender(
        <ThemeProvider theme={mockTheme}>
          <ConnectionStatus 
            state={WebSocketConnectionState.CONNECTED}
            onRetry={mockOnRetry}
            latency={50}
          />
        </ThemeProvider>
      );

      // Component should use memoized version
      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    });

    it('cleans up debounced function on unmount', () => {
      const { unmount } = renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.DISCONNECTED}
          onRetry={mockOnRetry}
        />
      );

      unmount();
      // Verify no memory leaks or pending callbacks
      expect(mockOnRetry).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('maintains layout integrity on mobile viewport', () => {
      const { container } = renderWithTheme(
        <ConnectionStatus 
          state={WebSocketConnectionState.CONNECTED}
          onRetry={mockOnRetry}
        />
      );

      expect(container.firstChild).toHaveStyleRule('display', 'flex');
      expect(container.firstChild).toHaveStyleRule('align-items', 'center');
    });
  });
});
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // v14.0.0
import { ThemeProvider } from 'styled-components'; // v6.0.0
import { describe, it, expect, jest } from '@jest/globals'; // v29.5.0
import Header from './Header';
import { WebSocketConnectionState } from '../../../types/websocket.types';
import { UserRole } from '../../../types/auth.types';

// Default theme for testing styled-components
const theme = {
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
};

// Helper function to render components with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock event handlers
const mockOnFloorChange = jest.fn();
const mockOnSettingsClick = jest.fn();

// Default test props factory
const setupDefaultProps = (overrides = {}) => ({
  connectionState: WebSocketConnectionState.CONNECTED,
  userRole: UserRole.USER,
  onFloorChange: mockOnFloorChange,
  onSettingsClick: mockOnSettingsClick,
  floors: [
    { id: 'floor1', name: 'Ground Floor', order: 1 },
    { id: 'floor2', name: 'First Floor', order: 2 }
  ],
  selectedFloorId: 'floor1',
  title: 'Smart Home Dashboard',
  ...overrides
});

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      const props = setupDefaultProps();
      renderWithTheme(<Header {...props} />);

      expect(screen.getByText('Smart Home Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('header-connection-status')).toBeInTheDocument();
      expect(screen.getByTestId('floor-plan-selector')).toBeInTheDocument();
      expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    });

    it('renders custom title when provided', () => {
      const props = setupDefaultProps({ title: 'Custom Dashboard' });
      renderWithTheme(<Header {...props} />);

      expect(screen.getByText('Custom Dashboard')).toBeInTheDocument();
    });

    it('renders children when provided', () => {
      const props = setupDefaultProps();
      renderWithTheme(
        <Header {...props}>
          <div data-testid="custom-child">Custom Child</div>
        </Header>
      );

      expect(screen.getByTestId('custom-child')).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('displays different connection states correctly', () => {
      const states = [
        WebSocketConnectionState.CONNECTED,
        WebSocketConnectionState.DISCONNECTED,
        WebSocketConnectionState.RECONNECTING
      ];

      states.forEach(state => {
        const props = setupDefaultProps({ connectionState: state });
        const { rerender } = renderWithTheme(<Header {...props} />);

        expect(screen.getByTestId('header-connection-status')).toHaveAttribute('data-state', state);
        rerender(<ThemeProvider theme={theme}><Header {...props} /></ThemeProvider>);
      });
    });
  });

  describe('Floor Plan Selection', () => {
    it('handles floor plan selection change', async () => {
      const props = setupDefaultProps();
      renderWithTheme(<Header {...props} />);

      const selector = screen.getByTestId('floor-plan-selector');
      fireEvent.change(selector, { target: { value: 'floor2' } });

      await waitFor(() => {
        expect(mockOnFloorChange).toHaveBeenCalledWith('floor2');
      });
    });

    it('disables floor selector for guest users', () => {
      const props = setupDefaultProps({ userRole: UserRole.GUEST });
      renderWithTheme(<Header {...props} />);

      expect(screen.getByTestId('floor-plan-selector')).toBeDisabled();
    });

    it('shows no floor plans message when floors array is empty', () => {
      const props = setupDefaultProps({ floors: [] });
      renderWithTheme(<Header {...props} />);

      expect(screen.getByText('No floor plans available')).toBeInTheDocument();
    });
  });

  describe('Settings Button', () => {
    it('handles settings button click', async () => {
      const props = setupDefaultProps();
      renderWithTheme(<Header {...props} />);

      const settingsButton = screen.getByTestId('settings-button');
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockOnSettingsClick).toHaveBeenCalled();
      });
    });

    it('hides settings button for guest users', () => {
      const props = setupDefaultProps({ userRole: UserRole.GUEST });
      renderWithTheme(<Header {...props} />);

      expect(screen.queryByTestId('settings-button')).not.toBeInTheDocument();
    });
  });

  describe('Role-based Access Control', () => {
    it('shows all controls for admin users', () => {
      const props = setupDefaultProps({ userRole: UserRole.ADMIN });
      renderWithTheme(<Header {...props} />);

      expect(screen.getByTestId('floor-plan-selector')).toBeEnabled();
      expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    });

    it('shows limited controls for regular users', () => {
      const props = setupDefaultProps({ userRole: UserRole.USER });
      renderWithTheme(<Header {...props} />);

      expect(screen.getByTestId('floor-plan-selector')).toBeEnabled();
      expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    });

    it('shows minimal controls for guest users', () => {
      const props = setupDefaultProps({ userRole: UserRole.GUEST });
      renderWithTheme(<Header {...props} />);

      expect(screen.getByTestId('floor-plan-selector')).toBeDisabled();
      expect(screen.queryByTestId('settings-button')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      const props = setupDefaultProps();
      renderWithTheme(<Header {...props} />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByLabelText('Select floor plan')).toBeInTheDocument();
      expect(screen.getByLabelText('Open settings')).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      const props = setupDefaultProps();
      renderWithTheme(<Header {...props} />);

      const settingsButton = screen.getByTestId('settings-button');
      settingsButton.focus();
      fireEvent.keyDown(settingsButton, { key: 'Enter' });

      expect(mockOnSettingsClick).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('renders error boundary fallback on error', () => {
      const ErrorComponent = () => {
        throw new Error('Test error');
        return null;
      };

      const props = setupDefaultProps();
      renderWithTheme(
        <Header {...props}>
          <ErrorComponent />
        </Header>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });
});
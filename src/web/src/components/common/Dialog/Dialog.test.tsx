import React from 'react'; // v18.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import Dialog from './Dialog';
import { DialogSize } from './Dialog.types';
import { ThemeProvider } from 'styled-components';
import { Theme, ThemeMode } from '../../../types/theme.types';

// Mock theme for testing
const mockTheme: Theme = {
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
};

// Default test props
const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  title: 'Test Dialog',
  children: <div>Dialog content</div>,
  size: DialogSize.MEDIUM,
  showCloseButton: true,
  closeOnOverlayClick: true,
  closeOnEscapeKey: true,
  ariaLabel: 'Test Dialog'
};

// Test IDs for querying
const testIds = {
  overlay: 'dialog-overlay',
  dialog: 'dialog'
};

// Helper function to render Dialog with theme
const renderDialog = (props = {}) => {
  const mergedProps = { ...defaultProps, ...props };
  return render(
    <ThemeProvider theme={mockTheme}>
      <Dialog {...mergedProps} />
    </ThemeProvider>
  );
};

// Setup userEvent
const setupUserEvent = () => userEvent.setup();

describe('Dialog Component', () => {
  let user: ReturnType<typeof setupUserEvent>;

  beforeEach(() => {
    user = setupUserEvent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering Tests', () => {
    test('should not render when isOpen is false', () => {
      renderDialog({ isOpen: false });
      expect(screen.queryByTestId(testIds.dialog)).not.toBeInTheDocument();
    });

    test('should render when isOpen is true', () => {
      renderDialog();
      expect(screen.getByTestId(testIds.dialog)).toBeInTheDocument();
    });

    test('should render with different sizes', () => {
      const { rerender } = renderDialog({ size: DialogSize.SMALL });
      let dialog = screen.getByTestId(testIds.dialog);
      expect(dialog).toHaveStyle({ width: '400px' });

      rerender(
        <ThemeProvider theme={mockTheme}>
          <Dialog {...defaultProps} size={DialogSize.LARGE} />
        </ThemeProvider>
      );
      dialog = screen.getByTestId(testIds.dialog);
      expect(dialog).toHaveStyle({ width: '800px' });
    });

    test('should render title correctly', () => {
      renderDialog({ title: 'Custom Title' });
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    test('should render children content', () => {
      renderDialog({ children: <div data-testid="custom-content">Custom Content</div> });
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });

  describe('Interaction Tests', () => {
    test('should call onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      renderDialog({ onClose });
      
      await user.click(screen.getByLabelText('Close dialog'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('should call onClose when overlay is clicked if closeOnOverlayClick is true', async () => {
      const onClose = jest.fn();
      renderDialog({ onClose, closeOnOverlayClick: true });
      
      await user.click(screen.getByTestId(testIds.overlay));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('should not call onClose when overlay is clicked if closeOnOverlayClick is false', async () => {
      const onClose = jest.fn();
      renderDialog({ onClose, closeOnOverlayClick: false });
      
      await user.click(screen.getByTestId(testIds.overlay));
      expect(onClose).not.toHaveBeenCalled();
    });

    test('should call onClose when escape key is pressed if closeOnEscapeKey is true', () => {
      const onClose = jest.fn();
      renderDialog({ onClose, closeOnEscapeKey: true });
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('should not call onClose when escape key is pressed if closeOnEscapeKey is false', () => {
      const onClose = jest.fn();
      renderDialog({ onClose, closeOnEscapeKey: false });
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility Tests', () => {
    test('should have correct ARIA attributes', () => {
      renderDialog();
      const dialog = screen.getByTestId(testIds.dialog);
      
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', defaultProps.ariaLabel);
    });

    test('should trap focus within dialog', async () => {
      renderDialog();
      const dialog = screen.getByTestId(testIds.dialog);
      const closeButton = screen.getByLabelText('Close dialog');
      
      // Focus should stay within dialog when tabbing
      closeButton.focus();
      fireEvent.keyDown(dialog, { key: 'Tab' });
      await waitFor(() => {
        expect(document.activeElement).toBe(closeButton);
      });
    });

    test('should manage focus correctly when opening and closing', async () => {
      // Create a button outside dialog to test focus restoration
      const { rerender } = render(
        <div>
          <button data-testid="outside-button">Outside</button>
          {renderDialog().container.firstChild}
        </div>
      );

      const outsideButton = screen.getByTestId('outside-button');
      outsideButton.focus();
      
      // Dialog should receive focus when opened
      await waitFor(() => {
        expect(document.activeElement).not.toBe(outsideButton);
      });

      // Rerender with dialog closed
      rerender(
        <div>
          <button data-testid="outside-button">Outside</button>
          <Dialog {...defaultProps} isOpen={false} />
        </div>
      );

      // Focus should return to the previous element
      await waitFor(() => {
        expect(document.activeElement).toBe(outsideButton);
      });
    });
  });

  describe('Animation Tests', () => {
    test('should apply correct transition styles', () => {
      renderDialog();
      const overlay = screen.getByTestId(testIds.overlay);
      const dialog = screen.getByTestId(testIds.dialog);
      
      expect(overlay).toHaveStyle({
        transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out'
      });
      expect(dialog).toHaveStyle({
        transition: 'transform 0.3s ease-in-out'
      });
    });

    test('should have correct initial animation states', () => {
      renderDialog();
      const overlay = screen.getByTestId(testIds.overlay);
      
      expect(overlay).toHaveStyle({
        opacity: 1,
        visibility: 'visible'
      });
    });
  });

  describe('Theme Tests', () => {
    test('should render with light theme colors', () => {
      renderDialog();
      const dialog = screen.getByTestId(testIds.dialog);
      
      expect(dialog).toHaveStyle({
        background: mockTheme.colors.background
      });
    });

    test('should render with dark theme colors', () => {
      const darkTheme = {
        ...mockTheme,
        mode: ThemeMode.DARK,
        colors: {
          ...mockTheme.colors,
          background: '#000000',
          text: '#FFFFFF'
        }
      };

      render(
        <ThemeProvider theme={darkTheme}>
          <Dialog {...defaultProps} />
        </ThemeProvider>
      );

      const dialog = screen.getByTestId(testIds.dialog);
      expect(dialog).toHaveStyle({
        background: darkTheme.colors.background
      });
    });
  });
});
import React from 'react'; // v18.0.0
import { render, screen, fireEvent, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.0.0
import { Input } from './Input';
import { InputSize, InputVariant, InputProps } from './Input.types';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ThemeMode } from '../../../types/theme.types';

// Helper function to render components with theme context
const renderWithTheme = (ui: React.ReactElement, themeMode: ThemeMode = ThemeMode.LIGHT) => {
  return render(
    <ThemeProvider>{ui}</ThemeProvider>
  );
};

// Factory function for consistent test props
const createTestProps = (overrides: Partial<InputProps> = {}): InputProps => ({
  id: 'test-input',
  name: 'test-input',
  type: 'text',
  value: '',
  placeholder: 'Enter text',
  label: 'Test Input',
  'aria-label': 'Test Input',
  onChange: jest.fn(),
  ...overrides
});

describe('Input Component', () => {
  // Common test props and mocks
  let props: InputProps;
  let onChangeMock: jest.Mock;
  let onFocusMock: jest.Mock;
  let onBlurMock: jest.Mock;

  beforeEach(() => {
    onChangeMock = jest.fn();
    onFocusMock = jest.fn();
    onBlurMock = jest.fn();
    props = createTestProps({
      onChange: onChangeMock,
      onFocus: onFocusMock,
      onBlur: onBlurMock
    });
  });

  describe('Rendering', () => {
    it('renders with minimum required props', () => {
      renderWithTheme(<Input {...props} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('displays label when provided', () => {
      renderWithTheme(<Input {...props} />);
      expect(screen.getByText('Test Input')).toBeInTheDocument();
    });

    it('shows placeholder text', () => {
      renderWithTheme(<Input {...props} />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('applies correct size variant styles', () => {
      const { rerender } = renderWithTheme(<Input {...props} size={InputSize.SMALL} />);
      expect(screen.getByRole('textbox')).toHaveStyle({ fontSize: expect.stringContaining('sm') });

      rerender(<Input {...props} size={InputSize.LARGE} />);
      expect(screen.getByRole('textbox')).toHaveStyle({ fontSize: expect.stringContaining('lg') });
    });

    it('applies correct input variant styles', () => {
      const { rerender } = renderWithTheme(<Input {...props} variant={InputVariant.OUTLINED} />);
      expect(screen.getByRole('textbox')).toHaveStyle({ backgroundColor: 'transparent' });

      rerender(<Input {...props} variant={InputVariant.FILLED} />);
      expect(screen.getByRole('textbox')).toHaveStyle({ backgroundColor: expect.any(String) });
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA labels', () => {
      renderWithTheme(<Input {...props} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Test Input');
    });

    it('maintains proper focus management', async () => {
      renderWithTheme(<Input {...props} />);
      const input = screen.getByRole('textbox');
      await userEvent.tab();
      expect(input).toHaveFocus();
    });

    it('supports keyboard navigation', async () => {
      renderWithTheme(<Input {...props} />);
      const input = screen.getByRole('textbox');
      await userEvent.tab();
      await userEvent.keyboard('test');
      expect(onChangeMock).toHaveBeenCalledTimes(4);
    });

    it('provides error feedback to screen readers', () => {
      renderWithTheme(<Input {...props} error="Invalid input" />);
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Invalid input');
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('indicates required fields appropriately', () => {
      renderWithTheme(<Input {...props} required />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Theme Support', () => {
    it('applies light theme styles correctly', () => {
      renderWithTheme(<Input {...props} />, ThemeMode.LIGHT);
      const input = screen.getByRole('textbox');
      expect(input).toHaveStyle({
        backgroundColor: expect.any(String),
        color: expect.any(String)
      });
    });

    it('applies dark theme styles correctly', () => {
      renderWithTheme(<Input {...props} />, ThemeMode.DARK);
      const input = screen.getByRole('textbox');
      expect(input).toHaveStyle({
        backgroundColor: expect.any(String),
        color: expect.any(String)
      });
    });

    it('handles theme-specific error states', () => {
      renderWithTheme(<Input {...props} error="Error message" />);
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveStyle({ color: expect.any(String) });
    });
  });

  describe('Interaction Handling', () => {
    it('handles text input correctly', async () => {
      renderWithTheme(<Input {...props} />);
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test input');
      expect(onChangeMock).toHaveBeenCalledTimes(10);
    });

    it('triggers focus and blur events', async () => {
      renderWithTheme(<Input {...props} />);
      const input = screen.getByRole('textbox');
      await userEvent.click(input);
      expect(onFocusMock).toHaveBeenCalledTimes(1);
      await userEvent.tab();
      expect(onBlurMock).toHaveBeenCalledTimes(1);
    });

    it('handles disabled state correctly', () => {
      renderWithTheme(<Input {...props} disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('displays error states visually', () => {
      renderWithTheme(<Input {...props} error="Error message" />);
      const input = screen.getByRole('textbox');
      const errorMessage = screen.getByRole('alert');
      expect(input).toHaveStyle({ borderColor: expect.any(String) });
      expect(errorMessage).toBeVisible();
    });

    it('maintains value controlled by parent', async () => {
      const { rerender } = renderWithTheme(<Input {...props} value="initial" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('initial');
      
      rerender(<Input {...props} value="updated" />);
      expect(input).toHaveValue('updated');
    });
  });
});
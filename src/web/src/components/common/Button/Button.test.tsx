import React from 'react'; // v18.0.0
import { render, fireEvent, screen, within } from '@testing-library/react'; // v14.0.0
import { ThemeProvider } from 'styled-components'; // v6.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // v4.7.0
import Button from './Button';
import { ButtonProps, ButtonVariant, ButtonSize } from './Button.types';
import { Theme, ThemeMode } from '../../../types/theme.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock theme for testing
const mockLightTheme: Theme = {
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

const mockDarkTheme: Theme = {
  mode: ThemeMode.DARK,
  colors: {
    background: '#000000',
    text: '#FFFFFF',
    primary: '#0A84FF',
    secondary: '#5E5CE6',
    border: '#38383A',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A'
  }
};

// Helper function to render components with theme
const renderWithTheme = (ui: React.ReactNode, theme: Theme = mockLightTheme) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('Button rendering', () => {
  it('renders with default props', () => {
    renderWithTheme(
      <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
        Click me
      </Button>
    );
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveStyle({
      backgroundColor: mockLightTheme.colors.primary,
      padding: '12px 24px',
      fontSize: '1rem'
    });
  });

  it('applies correct variant styles', () => {
    const { rerender } = renderWithTheme(
      <Button variant={ButtonVariant.SUCCESS} size={ButtonSize.MEDIUM}>
        Success
      </Button>
    );
    
    let button = screen.getByRole('button');
    expect(button).toHaveStyle({ backgroundColor: mockLightTheme.colors.success });

    rerender(
      <ThemeProvider theme={mockLightTheme}>
        <Button variant={ButtonVariant.ERROR} size={ButtonSize.MEDIUM}>
          Error
        </Button>
      </ThemeProvider>
    );
    
    button = screen.getByRole('button');
    expect(button).toHaveStyle({ backgroundColor: mockLightTheme.colors.error });
  });

  it('applies correct size styles', () => {
    const { rerender } = renderWithTheme(
      <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.SMALL}>
        Small
      </Button>
    );
    
    let button = screen.getByRole('button');
    expect(button).toHaveStyle({
      padding: '8px 16px',
      fontSize: '0.875rem'
    });

    rerender(
      <ThemeProvider theme={mockLightTheme}>
        <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.LARGE}>
          Large
        </Button>
      </ThemeProvider>
    );
    
    button = screen.getByRole('button');
    expect(button).toHaveStyle({
      padding: '16px 32px',
      fontSize: '1.125rem'
    });
  });

  it('handles fullWidth prop', () => {
    renderWithTheme(
      <Button
        variant={ButtonVariant.PRIMARY}
        size={ButtonSize.MEDIUM}
        fullWidth
      >
        Full Width
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({
      display: 'block',
      width: '100%'
    });
  });

  it('maintains style consistency across theme switches', () => {
    const { rerender } = renderWithTheme(
      <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
        Theme Switch
      </Button>
    );
    
    let button = screen.getByRole('button');
    const lightThemeColor = getComputedStyle(button).backgroundColor;

    rerender(
      <ThemeProvider theme={mockDarkTheme}>
        <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
          Theme Switch
        </Button>
      </ThemeProvider>
    );
    
    button = screen.getByRole('button');
    expect(getComputedStyle(button).backgroundColor).not.toBe(lightThemeColor);
  });
});

describe('Button interactions', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('handles click events', () => {
    renderWithTheme(
      <Button
        variant={ButtonVariant.PRIMARY}
        size={ButtonSize.MEDIUM}
        onClick={mockOnClick}
      >
        Click Test
      </Button>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard events (Enter/Space)', () => {
    renderWithTheme(
      <Button
        variant={ButtonVariant.PRIMARY}
        size={ButtonSize.MEDIUM}
        onClick={mockOnClick}
      >
        Keyboard Test
      </Button>
    );
    
    const button = screen.getByRole('button');
    
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: ' ' });
    expect(mockOnClick).toHaveBeenCalledTimes(2);
  });

  it('prevents interaction when disabled', () => {
    renderWithTheme(
      <Button
        variant={ButtonVariant.PRIMARY}
        size={ButtonSize.MEDIUM}
        onClick={mockOnClick}
        disabled
      >
        Disabled
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('maintains focus states', () => {
    renderWithTheme(
      <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
        Focus Test
      </Button>
    );
    
    const button = screen.getByRole('button');
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});

describe('Button accessibility', () => {
  it('has correct ARIA attributes', () => {
    renderWithTheme(
      <Button
        variant={ButtonVariant.PRIMARY}
        size={ButtonSize.MEDIUM}
        ariaLabel="Test Button"
        ariaExpanded={true}
        ariaControls="test-panel"
      >
        ARIA Test
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Test Button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'test-panel');
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderWithTheme(
      <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
        Accessibility Test
      </Button>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has sufficient touch target size', () => {
    renderWithTheme(
      <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
        Touch Target
      </Button>
    );
    
    const button = screen.getByRole('button');
    const { height } = button.getBoundingClientRect();
    expect(height).toBeGreaterThanOrEqual(44); // WCAG touch target size
  });
});

describe('Button performance', () => {
  it('renders efficiently', () => {
    const { rerender } = renderWithTheme(
      <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
        Performance Test
      </Button>
    );
    
    const startTime = performance.now();
    
    for (let i = 0; i < 100; i++) {
      rerender(
        <ThemeProvider theme={mockLightTheme}>
          <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
            Performance Test {i}
          </Button>
        </ThemeProvider>
      );
    }
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(1000); // Should render 100 times under 1 second
  });

  it('optimizes re-renders', () => {
    const renderCount = jest.fn();
    
    const TestComponent = () => {
      React.useEffect(renderCount, []);
      return (
        <Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM}>
          Re-render Test
        </Button>
      );
    };
    
    const { rerender } = renderWithTheme(<TestComponent />);
    rerender(<TestComponent />);
    
    expect(renderCount).toHaveBeenCalledTimes(1);
  });
});
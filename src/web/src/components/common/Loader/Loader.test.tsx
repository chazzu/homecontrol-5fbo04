// react version: ^18.0.0
// @testing-library/react version: ^14.0.0
// styled-components version: ^6.0.0
// jest-axe version: ^7.0.0

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { axe, toHaveNoViolations } from 'jest-axe';
import Loader from './Loader';
import { LoaderSize, LoaderVariant } from './Loader.types';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock theme for testing
const mockTheme = {
  colors: {
    primary: '#007AFF',
    background: '#FFFFFF',
    text: '#000000'
  },
  spacing: {
    small: '4px',
    medium: '8px',
    large: '16px'
  }
};

// Helper function to render with theme
const renderWithTheme = (ui: React.ReactElement, theme = mockTheme) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('Loader Component', () => {
  // Basic rendering tests
  describe('Default Rendering', () => {
    it('renders without crashing', () => {
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
        />
      );
      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('applies default aria-label when not provided', () => {
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
        />
      );
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading content');
    });
  });

  // Size variant tests
  describe('Size Variants', () => {
    it.each([
      [LoaderSize.SMALL, '16px'],
      [LoaderSize.MEDIUM, '24px'],
      [LoaderSize.LARGE, '48px']
    ])('renders with correct size for %s variant', (size, expectedSize) => {
      renderWithTheme(
        <Loader 
          size={size} 
          variant={LoaderVariant.SPINNER} 
        />
      );
      const loader = screen.getByTestId('loader');
      expect(loader).toHaveStyle(`width: ${expectedSize}`);
      expect(loader).toHaveStyle(`height: ${expectedSize}`);
    });
  });

  // Animation variant tests
  describe('Animation Variants', () => {
    it('renders spinner variant correctly', () => {
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
        />
      );
      // Spinner has a single child element
      expect(within(screen.getByTestId('loader')).getAllByRole('presentation')).toHaveLength(1);
    });

    it('renders dots variant correctly', () => {
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.DOTS} 
        />
      );
      // Dots variant has three dot elements
      const loader = screen.getByTestId('loader');
      expect(within(loader).getAllByRole('presentation')).toHaveLength(3);
    });
  });

  // Theme and styling tests
  describe('Theming and Styling', () => {
    it('applies custom color when provided', () => {
      const customColor = '#FF0000';
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
          color={customColor} 
        />
      );
      expect(screen.getByTestId('loader')).toHaveStyle(`color: ${customColor}`);
    });

    it('applies custom className when provided', () => {
      const customClass = 'custom-loader';
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
          className={customClass} 
        />
      );
      expect(screen.getByTestId('loader')).toHaveClass(customClass);
    });

    it('uses theme-aware color when no custom color provided', () => {
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
        />
      );
      const loader = screen.getByTestId('loader');
      expect(loader).toHaveStyle('color: var(--loader-color, var(--primary-color, #007AFF))');
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility standards', async () => {
      const { container } = renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('applies custom aria-label when provided', () => {
      const customLabel = 'Custom loading message';
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
          ariaLabel={customLabel} 
        />
      );
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', customLabel);
    });

    it('supports reduced motion preferences', () => {
      const { container } = renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
        />
      );
      
      // Check if the component has styles for reduced motion
      const styles = window.getComputedStyle(container.firstChild as Element);
      expect(styles).toMatchSnapshot();
    });
  });

  // Error handling and edge cases
  describe('Error Handling and Edge Cases', () => {
    it('handles invalid size prop gracefully', () => {
      // @ts-expect-error Testing invalid size prop
      renderWithTheme(
        <Loader 
          size="invalid" 
          variant={LoaderVariant.SPINNER} 
        />
      );
      // Should fall back to medium size
      expect(screen.getByTestId('loader')).toHaveStyle('width: 24px');
    });

    it('handles invalid variant prop gracefully', () => {
      // @ts-expect-error Testing invalid variant prop
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant="invalid" 
        />
      );
      // Should fall back to spinner variant
      expect(within(screen.getByTestId('loader')).getAllByRole('presentation')).toHaveLength(1);
    });

    it('handles empty string props gracefully', () => {
      renderWithTheme(
        <Loader 
          size={LoaderSize.MEDIUM} 
          variant={LoaderVariant.SPINNER} 
          color="" 
          className="" 
          ariaLabel="" 
        />
      );
      const loader = screen.getByTestId('loader');
      expect(loader).toBeInTheDocument();
      expect(loader).toHaveAttribute('aria-label', 'Loading content');
    });
  });
});
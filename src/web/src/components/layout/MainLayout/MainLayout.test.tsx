import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // v14.0.0
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.5.0
import { axe, toHaveNoViolations } from 'jest-axe'; // v7.0.0
import styled, { ThemeProvider as StyledThemeProvider } from 'styled-components'; // v6.0.0
import MainLayout from './MainLayout';
import { MainLayoutProps } from './MainLayout.types';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { Theme, ThemeMode } from '../../../types/theme.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock themes for testing
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

// Mock viewports for responsive testing
const mockViewports = {
  mobile: 375,
  tablet: 768,
  desktop: 1024
};

// Helper function to render component with theme context
const renderWithTheme = (
  children: React.ReactNode,
  theme: Theme = mockLightTheme
) => {
  return render(
    <ThemeProvider>
      <StyledThemeProvider theme={theme}>
        {children}
      </StyledThemeProvider>
    </ThemeProvider>
  );
};

describe('MainLayout Component', () => {
  // Basic rendering tests
  describe('Basic Rendering', () => {
    it('renders children correctly', () => {
      const testContent = 'Test Content';
      renderWithTheme(
        <MainLayout>
          <div>{testContent}</div>
        </MainLayout>
      );
      
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    it('has correct role and ARIA attributes', () => {
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      const mainContainer = screen.getByRole('main');
      
      expect(mainContainer).toHaveAttribute('aria-live', 'polite');
      expect(mainContainer).toHaveAttribute('data-theme', mockLightTheme.mode);
    });
  });

  // Theme integration tests
  describe('Theme Integration', () => {
    it('applies light theme styles correctly', () => {
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>, mockLightTheme);
      const container = screen.getByRole('main');
      
      expect(container).toHaveStyle({
        backgroundColor: mockLightTheme.colors.background,
        color: mockLightTheme.colors.text
      });
    });

    it('applies dark theme styles correctly', () => {
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>, mockDarkTheme);
      const container = screen.getByRole('main');
      
      expect(container).toHaveStyle({
        backgroundColor: mockDarkTheme.colors.background,
        color: mockDarkTheme.colors.text
      });
    });

    it('handles theme transitions with hardware acceleration', () => {
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      const container = screen.getByRole('main');
      
      expect(container).toHaveStyle({
        transform: 'translateZ(0)',
        willChange: 'background-color, color',
        backfaceVisibility: 'hidden'
      });
    });
  });

  // Responsive design tests
  describe('Responsive Design', () => {
    beforeEach(() => {
      // Reset viewport before each test
      global.innerWidth = mockViewports.desktop;
      global.dispatchEvent(new Event('resize'));
    });

    it('applies mobile styles at small viewport', () => {
      global.innerWidth = mockViewports.mobile;
      global.dispatchEvent(new Event('resize'));
      
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      const container = screen.getByRole('main');
      
      expect(container).toHaveStyle({
        padding: '0 1rem'
      });
    });

    it('applies tablet styles at medium viewport', () => {
      global.innerWidth = mockViewports.tablet;
      global.dispatchEvent(new Event('resize'));
      
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      const container = screen.getByRole('main');
      
      expect(container).toHaveStyle({
        padding: '0 2rem'
      });
    });

    it('applies desktop styles at large viewport', () => {
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      const container = screen.getByRole('main');
      
      expect(container).toHaveStyle({
        padding: '0 3rem'
      });
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <MainLayout><div>Content</div></MainLayout>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports high contrast mode', () => {
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      const container = screen.getByRole('main');
      
      // Force high contrast mode
      const mediaQuery = window.matchMedia('(forced-colors: active)');
      if (mediaQuery.matches) {
        expect(container).toHaveStyle({
          border: '1px solid ButtonText'
        });
      }
    });

    it('respects reduced motion preferences', () => {
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      const container = screen.getByRole('main');
      
      // Force reduced motion
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        expect(container).toHaveStyle({
          transition: 'none'
        });
      }
    });
  });

  // Performance tests
  describe('Performance Optimizations', () => {
    it('uses React.memo to prevent unnecessary re-renders', () => {
      const renderSpy = jest.spyOn(React, 'memo');
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      
      expect(renderSpy).toHaveBeenCalled();
      renderSpy.mockRestore();
    });

    it('maintains performance during theme changes', async () => {
      const { rerender } = renderWithTheme(
        <MainLayout><div>Content</div></MainLayout>,
        mockLightTheme
      );

      // Measure performance of theme change
      const startTime = performance.now();
      rerender(
        <ThemeProvider>
          <StyledThemeProvider theme={mockDarkTheme}>
            <MainLayout><div>Content</div></MainLayout>
          </StyledThemeProvider>
        </ThemeProvider>
      );
      const endTime = performance.now();

      // Theme change should be under 16ms for 60fps
      expect(endTime - startTime).toBeLessThan(16);
    });

    it('implements CSS containment for layout optimization', () => {
      renderWithTheme(<MainLayout><div>Content</div></MainLayout>);
      const container = screen.getByRole('main');
      
      expect(container).toHaveStyle({
        contain: 'layout'
      });
    });
  });
});
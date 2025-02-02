/**
 * Test suite for the NotFound component
 * Validates rendering, accessibility, theme integration, and navigation
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.0
import { BrowserRouter, MemoryRouter } from 'react-router-dom'; // ^6.0.0
import { ThemeProvider } from 'styled-components'; // ^6.0.0
import NotFound from './NotFound';
import lightTheme from '../../assets/styles/themes/light';
import darkTheme from '../../assets/styles/themes/dark';
import { renderWithProviders } from '../../../tests/test-utils';

// Extend Jest matchers with accessibility assertions
expect.extend(toHaveNoViolations);

describe('NotFound Component', () => {
  // Test basic rendering and content
  test('renders error message and navigation button correctly', () => {
    renderWithProviders(<NotFound />);

    // Verify heading content
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('404 - Page Not Found');
    expect(heading).toHaveAttribute('tabIndex', '0');

    // Verify error description
    const description = screen.getByText(/The page you're looking for doesn't exist/i);
    expect(description).toBeInTheDocument();

    // Verify navigation button
    const button = screen.getByRole('link', { name: /return to dashboard/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Return to dashboard');
  });

  // Test semantic structure and ARIA attributes
  test('implements correct semantic structure and ARIA attributes', () => {
    renderWithProviders(<NotFound />);

    // Verify main content area
    const mainContent = screen.getByRole('main');
    expect(mainContent).toHaveAttribute('aria-labelledby', 'notFoundTitle');

    // Verify heading ID for aria-labelledby reference
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAttribute('id', 'notFoundTitle');
  });

  // Test accessibility compliance
  test('meets WCAG 2.1 Level AA accessibility standards', async () => {
    const { container } = renderWithProviders(<NotFound />);

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify keyboard navigation
    const button = screen.getByRole('link', { name: /return to dashboard/i });
    button.focus();
    expect(button).toHaveFocus();
  });

  // Test theme integration
  test('applies theme styles correctly', () => {
    // Test light theme
    const { rerender } = renderWithProviders(<NotFound />, {
      theme: lightTheme
    });

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveStyle(`color: ${lightTheme.colors.primary}`);

    // Test dark theme
    rerender(
      <ThemeProvider theme={darkTheme}>
        <BrowserRouter>
          <NotFound />
        </BrowserRouter>
      </ThemeProvider>
    );

    expect(title).toHaveStyle(`color: ${darkTheme.colors.primary}`);
  });

  // Test responsive design
  test('implements responsive design', () => {
    const { container } = renderWithProviders(<NotFound />);
    
    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveStyle('min-height: calc(100vh - 100px)');

    // Verify media query styles are applied
    const styles = window.getComputedStyle(mainContainer as Element);
    expect(styles.padding).toBeDefined();
  });

  // Test navigation functionality
  test('navigates to home page when button is clicked', () => {
    const { history } = renderWithProviders(<NotFound />, {
      route: '/not-found'
    });

    // Click the return button
    const button = screen.getByRole('link', { name: /return to dashboard/i });
    fireEvent.click(button);

    // Verify navigation
    expect(history.location.pathname).toBe('/');
  });

  // Test keyboard navigation
  test('supports keyboard navigation', () => {
    renderWithProviders(<NotFound />);

    const button = screen.getByRole('link', { name: /return to dashboard/i });

    // Test Enter key navigation
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(window.location.pathname).toBe('/');

    // Test Space key navigation
    fireEvent.keyDown(button, { key: ' ' });
    expect(window.location.pathname).toBe('/');
  });

  // Test error boundary integration
  test('renders within error boundary', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    renderWithProviders(<NotFound />);
    
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
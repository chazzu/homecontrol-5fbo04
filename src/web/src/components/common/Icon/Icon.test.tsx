import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components'; // v6.0.0
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import Icon from './Icon';
import { IconType, IconSize } from './Icon.types';

// Mock SVG imports
jest.mock('../../../assets/icons/devices', () => ({
  'light-bulb.svg': () => <svg data-testid="mock-device-icon" />,
}), { virtual: true });

jest.mock('../../../assets/icons/ui', () => ({
  'settings.svg': () => <svg data-testid="mock-ui-icon" />,
}), { virtual: true });

jest.mock('../../../assets/icons/status', () => ({
  'error.svg': () => <svg data-testid="mock-status-icon" />,
}), { virtual: true });

// Theme mock for testing
const mockTheme = {
  light: {
    iconColor: '#000000',
  },
  dark: {
    iconColor: '#FFFFFF',
  },
};

// Helper function to render with theme
const renderWithTheme = (ui: React.ReactElement, theme = mockTheme) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('Icon Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders different icon types correctly', async () => {
      const { rerender } = renderWithTheme(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
          title="Light Bulb"
        />
      );
      
      expect(await screen.findByTestId('icon-device-light-bulb')).toBeInTheDocument();
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Light Bulb');

      rerender(
        <Icon
          name="settings"
          type={IconType.UI}
          size={IconSize.MEDIUM}
          title="Settings"
        />
      );
      expect(await screen.findByTestId('icon-ui-settings')).toBeInTheDocument();

      rerender(
        <Icon
          name="error"
          type={IconType.STATUS}
          size={IconSize.MEDIUM}
          title="Error"
        />
      );
      expect(await screen.findByTestId('icon-status-error')).toBeInTheDocument();
    });

    test('handles size variants properly', async () => {
      const { rerender } = renderWithTheme(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.SMALL}
          title="Small Icon"
        />
      );
      
      let icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toHaveStyle({ width: '16px', height: '16px' });

      rerender(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
          title="Medium Icon"
        />
      );
      icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toHaveStyle({ width: '24px', height: '24px' });

      rerender(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.LARGE}
          title="Large Icon"
        />
      );
      icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toHaveStyle({ width: '32px', height: '32px' });
    });
  });

  describe('Theme Integration', () => {
    test('supports theme variants', async () => {
      const { rerender } = renderWithTheme(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
          themeVariant="light"
        />
      );
      
      let icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toHaveStyle({ color: 'var(--icon-color-light, #000000)' });

      rerender(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
          themeVariant="dark"
        />
      );
      icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toHaveStyle({ color: 'var(--icon-color-dark, #FFFFFF)' });
    });

    test('handles custom color override', async () => {
      renderWithTheme(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
          color="#FF0000"
        />
      );
      
      const icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toHaveStyle({ color: '#FF0000' });
    });
  });

  describe('Interaction Handling', () => {
    test('handles click events correctly', async () => {
      const handleClick = jest.fn();
      
      renderWithTheme(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
          onClick={handleClick}
        />
      );
      
      const icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toHaveStyle({ cursor: 'pointer' });
      
      fireEvent.click(icon);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('supports keyboard interaction', async () => {
      const handleClick = jest.fn();
      
      renderWithTheme(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
          onClick={handleClick}
        />
      );
      
      const icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toHaveAttribute('focusable', 'true');
      
      fireEvent.keyPress(icon, { key: 'Enter', code: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('handles missing icons gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      renderWithTheme(
        <Icon
          name="non-existent"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
        />
      );
      
      expect(consoleSpy).toHaveBeenCalledWith('Icon not found: non-existent');
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });

    test('validates required props', async () => {
      const { rerender } = renderWithTheme(
        <Icon
          name="light-bulb"
          type={IconType.DEVICE}
          size={IconSize.MEDIUM}
        />
      );
      
      const icon = await screen.findByTestId('icon-device-light-bulb');
      expect(icon).toBeInTheDocument();

      // @ts-expect-error - Testing invalid type
      rerender(<Icon name="light-bulb" type="invalid" size={IconSize.MEDIUM} />);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid icon type'));
    });
  });
});
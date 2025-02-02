import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ControlDialog from './ControlDialog';
import { EntityType } from '../../../types/entity.types';
import { PERFORMANCE_THRESHOLDS } from '../../../config/constants';

// Mock useEntity hook
const mockUseEntity = vi.fn(() => ({
  state: {
    entity_id: 'light.living_room',
    state: 'on',
    attributes: {
      brightness: 255,
      rgb_color: [255, 255, 255],
      friendly_name: 'Living Room Light'
    }
  },
  config: {
    type: EntityType.LIGHT,
    display_name: 'Living Room Light'
  },
  sendCommand: vi.fn(),
  supportsFeature: vi.fn((feature) => {
    const features = {
      brightness: true,
      color: true,
      color_temp: true
    };
    return features[feature] || false;
  })
}));

vi.mock('../../../hooks/useEntity', () => ({
  useEntity: mockUseEntity
}));

// Mock useAnimation hook
vi.mock('../../../hooks/useAnimation', () => ({
  useAnimation: vi.fn()
}));

// Default props for testing
const defaultProps = {
  entityId: 'light.living_room',
  isOpen: true,
  onClose: vi.fn()
};

// Helper function to render component with required context
const renderControlDialog = (props = {}) => {
  const mergedProps = { ...defaultProps, ...props };
  return render(<ControlDialog {...mergedProps} />);
};

describe('ControlDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('renders correctly with light entity controls', () => {
      renderControlDialog();
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Living Room Light')).toBeInTheDocument();
      expect(screen.getByLabelText('Brightness')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('renders color control when supported', () => {
      renderControlDialog();
      
      expect(screen.getByLabelText('Color')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument();
    });

    it('applies ARIA attributes correctly', () => {
      renderControlDialog();
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Control Living Room Light');
    });
  });

  describe('User Interactions', () => {
    it('handles brightness slider changes', async () => {
      const { useEntity } = await import('../../../hooks/useEntity');
      const sendCommand = vi.fn();
      (useEntity as jest.Mock).mockImplementation(() => ({
        ...mockUseEntity(),
        sendCommand
      }));

      renderControlDialog();
      
      const slider = screen.getByLabelText('Brightness');
      await userEvent.click(slider);
      fireEvent.change(slider, { target: { value: '128' } });
      
      expect(slider).toHaveValue('128');
      await waitFor(() => {
        expect(sendCommand).toHaveBeenCalledWith('set', { brightness: 128 });
      });
    });

    it('handles color picker changes', async () => {
      const { useEntity } = await import('../../../hooks/useEntity');
      const sendCommand = vi.fn();
      (useEntity as jest.Mock).mockImplementation(() => ({
        ...mockUseEntity(),
        sendCommand
      }));

      renderControlDialog();
      
      const colorPicker = screen.getByLabelText('Color');
      await userEvent.click(colorPicker);
      fireEvent.change(colorPicker, { target: { value: '#ff0000' } });
      
      await waitFor(() => {
        expect(sendCommand).toHaveBeenCalledWith('set', { rgb_color: [255, 0, 0] });
      });
    });

    it('handles form submission', async () => {
      const { useEntity } = await import('../../../hooks/useEntity');
      const sendCommand = vi.fn();
      (useEntity as jest.Mock).mockImplementation(() => ({
        ...mockUseEntity(),
        sendCommand
      }));

      renderControlDialog();
      
      const submitButton = screen.getByRole('button', { name: /apply changes/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(sendCommand).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Performance', () => {
    it('responds to user interactions within performance threshold', async () => {
      const startTime = performance.now();
      renderControlDialog();
      
      const slider = screen.getByLabelText('Brightness');
      await userEvent.click(slider);
      
      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxResponseTime);
    });

    it('handles state updates within sync latency threshold', async () => {
      const { useEntity } = await import('../../../hooks/useEntity');
      const sendCommand = vi.fn().mockImplementation(() => new Promise(resolve => {
        setTimeout(resolve, 50);
      }));
      
      (useEntity as jest.Mock).mockImplementation(() => ({
        ...mockUseEntity(),
        sendCommand
      }));

      renderControlDialog();
      
      const startTime = performance.now();
      const slider = screen.getByLabelText('Brightness');
      await userEvent.click(slider);
      fireEvent.change(slider, { target: { value: '128' } });
      
      await waitFor(() => {
        expect(sendCommand).toHaveBeenCalled();
        const syncLatency = performance.now() - startTime;
        expect(syncLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxSyncLatency);
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when command fails', async () => {
      const { useEntity } = await import('../../../hooks/useEntity');
      const sendCommand = vi.fn().mockRejectedValue(new Error('Command failed'));
      
      (useEntity as jest.Mock).mockImplementation(() => ({
        ...mockUseEntity(),
        sendCommand
      }));

      renderControlDialog();
      
      const slider = screen.getByLabelText('Brightness');
      await userEvent.click(slider);
      fireEvent.change(slider, { target: { value: '128' } });
      
      await waitFor(() => {
        expect(screen.getByText('Failed to update control. Please try again.')).toBeInTheDocument();
      });
    });

    it('handles network errors gracefully', async () => {
      const { useEntity } = await import('../../../hooks/useEntity');
      const sendCommand = vi.fn().mockRejectedValue(new Error('Network error'));
      
      (useEntity as jest.Mock).mockImplementation(() => ({
        ...mockUseEntity(),
        sendCommand
      }));

      renderControlDialog();
      
      const submitButton = screen.getByRole('button', { name: /apply changes/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to apply changes. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('manages focus correctly', async () => {
      renderControlDialog();
      
      expect(document.activeElement).toHaveAttribute('role', 'dialog');
      
      const slider = screen.getByLabelText('Brightness');
      await userEvent.tab();
      expect(document.activeElement).toBe(slider);
    });

    it('supports keyboard navigation', async () => {
      renderControlDialog();
      
      await userEvent.tab(); // Focus first control
      await userEvent.tab(); // Focus second control
      await userEvent.tab(); // Focus submit button
      
      expect(document.activeElement).toHaveTextContent('Apply Changes');
    });

    it('traps focus within dialog', async () => {
      renderControlDialog();
      
      const dialog = screen.getByRole('dialog');
      const focusableElements = within(dialog).queryAllByRole('button');
      
      await userEvent.tab();
      await userEvent.tab();
      await userEvent.tab();
      
      // Should cycle back to first focusable element
      expect(document.activeElement).toBe(focusableElements[0]);
    });
  });
});
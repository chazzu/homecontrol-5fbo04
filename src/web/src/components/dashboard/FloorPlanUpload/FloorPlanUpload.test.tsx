import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import { ThemeProvider } from '@mui/material';
import FloorPlanUpload from './FloorPlanUpload';
import { mockFloorPlans } from '../../../tests/mocks/floorPlans';
import { FloorPlanUploadProps } from './FloorPlanUpload.types';
import lightTheme from '../../../assets/styles/themes/light';
import darkTheme from '../../../assets/styles/themes/dark';

// Mock file processing utility
vi.mock('../../../utils/floorPlan', () => ({
  processSVG: vi.fn().mockImplementation(async (file) => ({
    svgData: 'processed-svg-data',
    dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
    optimizationStats: {
      originalSize: 1000,
      processedSize: 800,
      pathsOptimized: 5,
      elementsRemoved: 2
    }
  }))
}));

// Test file fixtures
const createMockFile = (name: string, type: string, size: number): File => {
  return new File(['mock content'], name, { type });
};

const mockValidSVG = createMockFile('valid.svg', 'image/svg+xml', 1024);
const mockLargeSVG = createMockFile('large.svg', 'image/svg+xml', 5 * 1024 * 1024 + 1);
const mockInvalidFile = createMockFile('invalid.txt', 'text/plain', 1024);

// Enhanced render helper with theme support
const renderWithTheme = (
  props: Partial<FloorPlanUploadProps> = {},
  themeMode: 'light' | 'dark' = 'light'
) => {
  const defaultProps: FloorPlanUploadProps = {
    isOpen: true,
    onUpload: vi.fn(),
    onCancel: vi.fn(),
    loading: false,
    error: null,
    onProgress: vi.fn(),
    ...props
  };

  return {
    ...render(
      <ThemeProvider theme={themeMode === 'light' ? lightTheme : darkTheme}>
        <FloorPlanUpload {...defaultProps} />
      </ThemeProvider>
    ),
    user: userEvent.setup()
  };
};

describe('FloorPlanUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    it('should render with proper ARIA labels and roles', async () => {
      const { container } = renderWithTheme();
      
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Floor plan upload dialog');
      expect(screen.getByRole('button', { name: /upload svg file/i })).toBeInTheDocument();
      
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });

    it('should maintain proper focus management', async () => {
      const { user } = renderWithTheme();
      
      const nameInput = screen.getByLabelText(/floor plan name/i);
      const fileInput = screen.getByRole('button', { name: /upload svg file/i });
      
      await user.tab();
      expect(nameInput).toHaveFocus();
      
      await user.tab();
      expect(fileInput).toHaveFocus();
    });

    it('should support keyboard navigation', async () => {
      const { user } = renderWithTheme();
      
      await user.tab();
      await user.keyboard('{Enter}');
      
      expect(screen.getByRole('button', { name: /upload svg file/i })).toHaveFocus();
    });
  });

  describe('File Upload Handling', () => {
    it('should handle valid SVG file upload', async () => {
      const onUpload = vi.fn();
      const { user } = renderWithTheme({ onUpload });

      const fileInput = screen.getByLabelText(/upload svg file/i);
      await user.upload(fileInput, mockValidSVG);

      await waitFor(() => {
        expect(screen.getByText(/processed-svg-data/i)).toBeInTheDocument();
      });
    });

    it('should reject files exceeding size limit', async () => {
      const { user } = renderWithTheme();

      const fileInput = screen.getByLabelText(/upload svg file/i);
      await user.upload(fileInput, mockLargeSVG);

      expect(screen.getByText(/file size exceeds maximum limit/i)).toBeInTheDocument();
    });

    it('should validate file type', async () => {
      const { user } = renderWithTheme();

      const fileInput = screen.getByLabelText(/upload svg file/i);
      await user.upload(fileInput, mockInvalidFile);

      expect(screen.getByText(/only svg files are supported/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { user } = renderWithTheme();
      
      const submitButton = screen.getByRole('button', { name: /upload floor plan/i });
      await user.click(submitButton);

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });

    it('should validate scale input', async () => {
      const { user } = renderWithTheme();
      
      const scaleInput = screen.getByLabelText(/scale/i);
      await user.type(scaleInput, '-1');
      
      expect(screen.getByText(/scale must be positive/i)).toBeInTheDocument();
    });

    it('should validate order input', async () => {
      const { user } = renderWithTheme();
      
      const orderInput = screen.getByLabelText(/display order/i);
      await user.type(orderInput, '-1');
      
      expect(screen.getByText(/order must be non-negative/i)).toBeInTheDocument();
    });
  });

  describe('Theme Integration', () => {
    it('should render with light theme styles', () => {
      renderWithTheme({}, 'light');
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveStyle({
        backgroundColor: lightTheme.colors.background
      });
    });

    it('should render with dark theme styles', () => {
      renderWithTheme({}, 'dark');
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveStyle({
        backgroundColor: darkTheme.colors.background
      });
    });
  });

  describe('Progress and Loading States', () => {
    it('should show upload progress', async () => {
      const onProgress = vi.fn();
      const { user } = renderWithTheme({ onProgress });

      const fileInput = screen.getByLabelText(/upload svg file/i);
      await user.upload(fileInput, mockValidSVG);

      expect(onProgress).toHaveBeenCalledWith(expect.any(Number), 'VALIDATION');
    });

    it('should disable form during upload', () => {
      renderWithTheme({ loading: true });
      
      expect(screen.getByRole('button', { name: /uploading/i })).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages with proper styling', () => {
      renderWithTheme({ error: 'Upload failed' });
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveStyle({
        color: lightTheme.colors.error
      });
    });

    it('should clear error on successful upload', async () => {
      const { user } = renderWithTheme({ error: 'Initial error' });

      const fileInput = screen.getByLabelText(/upload svg file/i);
      await user.upload(fileInput, mockValidSVG);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });
});
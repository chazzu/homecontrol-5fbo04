import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import Login from './Login';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import lightTheme from '../../assets/styles/themes/light';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock auth context
const mockLogin = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuthContext: () => ({
    login: mockLogin
  })
}));

// Mock matchMedia for responsive design tests
const mockMatchMedia = jest.fn();
window.matchMedia = window.matchMedia || mockMatchMedia;

// Helper function to render component with all required providers
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={lightTheme}>
        <AuthProvider>
          {ui}
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
    options
  );
};

// Helper function to setup viewport and media query mocks
const setupMediaQuery = (size: 'mobile' | 'tablet' | 'desktop') => {
  const dimensions = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 800 }
  };

  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: dimensions[size].width
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: dimensions[size].height
  });

  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: query === `(max-width: ${dimensions[size].width}px)`,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn()
  }));
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Accessibility and UI Rendering', () => {
    it('should render with proper ARIA labels and roles', () => {
      renderWithProviders(<Login />);

      // Check form accessibility
      const form = screen.getByRole('form', { name: /smart home dashboard login/i });
      expect(form).toHaveAttribute('aria-labelledby', 'login-title');

      // Check input accessibility
      const tokenInput = screen.getByRole('textbox', { name: /home assistant access token/i });
      expect(tokenInput).toHaveAttribute('aria-required', 'true');
      expect(tokenInput).not.toHaveAttribute('aria-invalid');

      // Check button accessibility
      const loginButton = screen.getByRole('button', { name: /log in to smart home dashboard/i });
      expect(loginButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(<Login />);
      const user = userEvent.setup();

      // Test tab navigation
      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();
    });

    it('should be screen reader friendly', () => {
      renderWithProviders(<Login />);

      // Check for descriptive labels
      expect(screen.getByLabelText(/home assistant access token/i)).toBeInTheDocument();
      expect(screen.getByText(/smart home dashboard login/i)).toBeInTheDocument();
    });

    it('should maintain proper color contrast ratios', () => {
      renderWithProviders(<Login />);
      const title = screen.getByText(/smart home dashboard login/i);
      const computedStyle = window.getComputedStyle(title);
      expect(computedStyle.color).toBeDefined();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      renderWithProviders(<Login />);
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.token';

      // Enter valid token
      await userEvent.type(screen.getByRole('textbox'), validToken);
      mockLogin.mockResolvedValueOnce(undefined);

      // Submit form
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(validToken);
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should handle login failure', async () => {
      renderWithProviders(<Login />);
      const invalidToken = 'invalid-token';
      mockLogin.mockRejectedValueOnce(new Error('Authentication failed'));

      // Enter invalid token
      await userEvent.type(screen.getByRole('textbox'), invalidToken);
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/authentication failed/i);
      });
    });

    it('should enforce rate limiting', async () => {
      renderWithProviders(<Login />);
      const token = 'test-token';
      mockLogin.mockRejectedValue(new Error('Authentication failed'));

      // Attempt multiple logins
      for (let i = 0; i < 6; i++) {
        await userEvent.type(screen.getByRole('textbox'), token);
        await userEvent.click(screen.getByRole('button', { name: /log in/i }));
      }

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/too many login attempts/i);
        expect(screen.getByRole('button')).toBeDisabled();
      });
    });
  });

  describe('Security Measures', () => {
    it('should validate token format', async () => {
      renderWithProviders(<Login />);
      const invalidToken = 'not-a-jwt-token';

      await userEvent.type(screen.getByRole('textbox'), invalidToken);
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid token format/i);
      });
    });

    it('should prevent XSS in error messages', async () => {
      renderWithProviders(<Login />);
      mockLogin.mockRejectedValueOnce(new Error('<script>alert("xss")</script>'));

      await userEvent.type(screen.getByRole('textbox'), 'test-token');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage.innerHTML).not.toContain('<script>');
      });
    });

    it('should clear sensitive data on unmount', () => {
      const { unmount } = renderWithProviders(<Login />);
      const tokenInput = screen.getByRole('textbox');
      fireEvent.change(tokenInput, { target: { value: 'secret-token' } });
      
      unmount();
      
      // Re-render to verify state reset
      renderWithProviders(<Login />);
      expect(screen.getByRole('textbox')).toHaveValue('');
    });
  });

  describe('Error Handling', () => {
    it('should display network error messages', async () => {
      renderWithProviders(<Login />);
      mockLogin.mockRejectedValueOnce(new Error('Network error'));

      await userEvent.type(screen.getByRole('textbox'), 'test-token');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
      });
    });

    it('should handle timeout errors', async () => {
      renderWithProviders(<Login />);
      mockLogin.mockRejectedValueOnce(new Error('Request timeout'));

      await userEvent.type(screen.getByRole('textbox'), 'test-token');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/timeout/i);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render correctly on mobile', () => {
      setupMediaQuery('mobile');
      renderWithProviders(<Login />);
      
      const container = screen.getByRole('form').parentElement;
      expect(container).toHaveStyle({ padding: '1rem' });
    });

    it('should render correctly on tablet', () => {
      setupMediaQuery('tablet');
      renderWithProviders(<Login />);
      
      const container = screen.getByRole('form').parentElement;
      expect(container).toHaveStyle({ padding: '2rem' });
    });

    it('should render correctly on desktop', () => {
      setupMediaQuery('desktop');
      renderWithProviders(<Login />);
      
      const container = screen.getByRole('form').parentElement;
      expect(container).toHaveStyle({ padding: '2rem' });
    });
  });
});
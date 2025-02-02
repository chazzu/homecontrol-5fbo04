/**
 * Entry point for the Smart Home Dashboard web application
 * Initializes React with StrictMode, renders the root App component,
 * and sets up development environment with performance monitoring
 * @version 1.0.0
 */

import React from 'react'; // ^18.0.0
import ReactDOM from 'react-dom/client'; // ^18.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import App from './App';
import { PERFORMANCE_THRESHOLDS, ERROR_CODES } from './config/constants';

/**
 * Initialize application with performance monitoring and error handling
 */
const initializeApp = (): void => {
  // Log application version and environment
  const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'development';
  console.info(`Smart Home Dashboard v${APP_VERSION}`);

  // Set up development tools
  if (import.meta.env.DEV) {
    // Enable React strict mode warnings
    console.info('Development mode enabled');
    
    // Monitor performance
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0]?.includes('performance')) {
        // Track performance warnings for monitoring
        const metric = args[0].match(/exceeded in (.*): (\d+)ms/);
        if (metric && parseInt(metric[2]) > PERFORMANCE_THRESHOLDS.maxResponseTime) {
          // Log performance violation for monitoring
          console.error(`Performance threshold exceeded: ${metric[1]} took ${metric[2]}ms`);
        }
      }
      originalWarn.apply(console, args);
    };
  }

  // Initialize error reporting
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', {
      message,
      source,
      lineno,
      colno,
      error,
      code: ERROR_CODES.AUTH.INVALID_TOKEN
    });
    return false;
  };
};

/**
 * Render the React application with error boundaries
 */
const renderApp = (): void => {
  // Get root element with type assertion
  const rootElement = document.getElementById('root') as HTMLElement;
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create React root using createRoot API
  const root = ReactDOM.createRoot(rootElement);

  // Error boundary fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div role="alert" style={{ padding: '20px', color: 'red' }}>
      <h2>Application Error</h2>
      <pre>{error.message}</pre>
    </div>
  );

  // Render application with error boundary and strict mode
  root.render(
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('Application render error:', error);
      }}
    >
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </ErrorBoundary>
  );

  // Set up hot module replacement for development
  if (import.meta.hot) {
    import.meta.hot.accept('./App', () => {
      console.info('HMR update accepted');
      renderApp();
    });
  }
};

// Initialize and render application
initializeApp();
renderApp();
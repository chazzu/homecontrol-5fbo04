import React, { Suspense, lazy, Profiler } from 'react'; // ^18.0.0
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // ^6.0.0
import { ThemeProvider as StyledThemeProvider } from 'styled-components'; // ^6.0.0
import { Helmet } from 'react-helmet-async'; // ^1.3.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import MainLayout from './components/layout/MainLayout/MainLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { APP_NAME, PERFORMANCE_THRESHOLDS, ERROR_CODES } from './config/constants';

// Lazy-loaded components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Global styles with theme support
import { createGlobalStyle } from 'styled-components';
const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: background-color 0.3s ease;
  }
`;

// Security headers based on technical specifications
const SecurityHeaders = {
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' wss://*.home-assistant.io",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// Protected route component with authentication check
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state: authState } = useAuthContext();

  if (!authState.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
  </div>
);

// Performance monitoring callback
const onRenderCallback = (
  id: string,
  phase: string,
  actualDuration: number
) => {
  if (actualDuration > PERFORMANCE_THRESHOLDS.maxResponseTime) {
    console.warn(
      `Performance threshold exceeded in ${id} during ${phase}: ${actualDuration}ms`
    );
  }
};

// Loading fallback component
const LoadingFallback = () => (
  <div role="progressbar" aria-label="Loading application">
    Loading...
  </div>
);

/**
 * Root application component implementing enterprise features
 * Provides global providers, routing, and security measures
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('Application error:', error);
        // Add error reporting service integration here
      }}
    >
      <Helmet>
        <title>{APP_NAME}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {Object.entries(SecurityHeaders).map(([key, value]) => (
          <meta key={key} httpEquiv={key} content={value} />
        ))}
      </Helmet>

      <Profiler id="App" onRender={onRenderCallback}>
        <ThemeProvider>
          <StyledThemeProvider theme={{}}>
            <GlobalStyle />
            <AuthProvider>
              <BrowserRouter>
                <MainLayout>
                  <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      <Route
                        path="/"
                        element={
                          <PrivateRoute>
                            <Dashboard />
                          </PrivateRoute>
                        }
                      />
                      <Route path="/login" element={<Login />} />
                      <Route
                        path="/settings"
                        element={
                          <PrivateRoute>
                            <Settings />
                          </PrivateRoute>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </MainLayout>
              </BrowserRouter>
            </AuthProvider>
          </StyledThemeProvider>
        </ThemeProvider>
      </Profiler>
    </ErrorBoundary>
  );
};

export default App;
/**
 * Root layout component for Smart Home Dashboard
 * Provides theme-aware styling, responsive structure, and accessibility features
 * @version 1.0.0
 */

import React from 'react'; // ^18.0.0
import styled from 'styled-components'; // ^6.0.0
import { MainLayoutProps } from './MainLayout.types';
import { useThemeContext } from '../../../contexts/ThemeContext';

/**
 * Styled container component with theme-aware styles and responsive design
 * Implements hardware-accelerated transitions for smooth theme switching
 */
const Container = styled.div<{ theme: MainLayoutProps['theme'] }>`
  /* Base layout structure */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow-x: hidden;

  /* Theme-aware colors with hardware-accelerated transitions */
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateZ(0);
  will-change: background-color, color;
  backface-visibility: hidden;

  /* Responsive padding based on viewport size */
  @media (max-width: 768px) {
    padding: 0 1rem;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    padding: 0 2rem;
  }

  @media (min-width: 1025px) {
    padding: 0 3rem;
  }

  /* High-contrast mode support */
  @media (forced-colors: active) {
    border: 1px solid ButtonText;
  }

  /* Reduced motion preference support */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/**
 * MainLayout component providing the root structure for the application
 * Implements theme context, accessibility features, and responsive design
 * 
 * @param {MainLayoutProps} props - Component props
 * @returns {JSX.Element} Themed and structured layout container
 */
const MainLayout: React.FC<MainLayoutProps> = React.memo(({ children }) => {
  // Access current theme from context
  const { theme } = useThemeContext();

  return (
    <Container
      theme={theme}
      role="main"
      aria-live="polite"
      data-theme={theme.mode}
    >
      {children}
    </Container>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

// Default export for the component
export default MainLayout;
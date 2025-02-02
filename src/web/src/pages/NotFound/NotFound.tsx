/**
 * 404 Not Found page component for Smart Home Dashboard
 * Provides user-friendly error message and navigation with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import React from 'react'; // ^18.0.0
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import styled from 'styled-components'; // ^6.0.0
import MainLayout from '../../components/layout/MainLayout/MainLayout';
import Button from '../../components/common/Button/Button';
import { ButtonVariant } from '../../components/common/Button/Button.types';

// Styled container with responsive layout and theme-aware styles
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 100px);
  text-align: center;
  padding: 2rem;

  /* Responsive adjustments */
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

// Theme-aware title component with proper visual hierarchy
const Title = styled.h1`
  font-size: 3rem;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;

  /* Responsive font size */
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }

  /* High contrast support */
  @media (forced-colors: active) {
    color: CanvasText;
  }
`;

// Theme-aware description text with proper contrast ratio
const Description = styled.p`
  font-size: 1.2rem;
  margin-bottom: 2rem;
  color: ${({ theme }) => theme.colors.text};
  max-width: 600px;
  line-height: 1.5;

  /* Responsive font size */
  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

/**
 * NotFound component for handling 404 error states
 * Implements accessible navigation and theme-aware styling
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();

  // Handle navigation back to dashboard
  const handleNavigateHome = () => {
    navigate('/');
  };

  return (
    <MainLayout>
      <Container role="main" aria-labelledby="notFoundTitle">
        <Title id="notFoundTitle" tabIndex={0}>
          404 - Page Not Found
        </Title>
        <Description>
          The page you're looking for doesn't exist or has been moved.
          Please return to the dashboard to continue managing your smart home.
        </Description>
        <Button
          variant={ButtonVariant.PRIMARY}
          onClick={handleNavigateHome}
          ariaLabel="Return to dashboard"
          role="link"
        >
          Return to Dashboard
        </Button>
      </Container>
    </MainLayout>
  );
};

export default NotFound;
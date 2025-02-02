import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components'; // v6.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import { HeaderProps } from './Header.types';
import ConnectionStatus from '../ConnectionStatus/ConnectionStatus';
import Button from '../../common/Button/Button';
import Icon from '../../common/Icon/Icon';
import { IconType, IconSize } from '../../common/Icon/Icon.types';
import { ButtonVariant, ButtonSize } from '../../common/Button/Button.types';
import { WebSocketConnectionState } from '../../../types/websocket.types';
import { UserRole } from '../../../types/auth.types';

// Styled components with theme integration
const StyledHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: ${({ theme }) => theme.colors.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  @media (max-width: 768px) {
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
  }
`;

const StyledNav = styled.nav`
  display: flex;
  align-items: center;
  gap: 16px;

  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const StyledSelect = styled.select`
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-size: 14px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledTitle = styled.h1`
  font-size: 20px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

/**
 * Error fallback component for the header
 */
const HeaderErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <StyledHeader>
    <div role="alert">
      <p>Something went wrong in the header component:</p>
      <pre style={{ color: 'red' }}>{error.message}</pre>
    </div>
  </StyledHeader>
);

/**
 * Enhanced header component with role-based access control and accessibility features
 */
const Header: React.FC<HeaderProps> = React.memo(({
  connectionState,
  userRole,
  onFloorChange,
  onSettingsClick,
  className,
  floors = [],
  selectedFloorId,
  title = "Smart Home Dashboard",
  children
}) => {
  // Handle connection retry
  const handleRetry = useCallback(() => {
    console.log('[Header] Initiating connection retry');
    window.location.reload();
  }, []);

  // Handle floor plan change with role-based access control
  const handleFloorChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    if (userRole !== UserRole.GUEST) {
      onFloorChange(event.target.value);
    }
  }, [userRole, onFloorChange]);

  // Determine if settings access is allowed based on user role
  const canAccessSettings = useMemo(() => 
    userRole === UserRole.ADMIN || userRole === UserRole.USER,
    [userRole]
  );

  return (
    <ErrorBoundary FallbackComponent={HeaderErrorFallback}>
      <StyledHeader className={className} role="banner">
        <StyledTitle>{title}</StyledTitle>
        
        <StyledNav>
          <ConnectionStatus
            state={connectionState}
            onRetry={handleRetry}
            data-testid="header-connection-status"
          />

          <StyledSelect
            value={selectedFloorId}
            onChange={handleFloorChange}
            disabled={userRole === UserRole.GUEST || floors.length === 0}
            aria-label="Select floor plan"
            data-testid="floor-plan-selector"
          >
            {floors.length === 0 ? (
              <option value="">No floor plans available</option>
            ) : (
              <>
                <option value="">Select a floor plan</option>
                {floors.map(floor => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name}
                  </option>
                ))}
              </>
            )}
          </StyledSelect>

          {canAccessSettings && (
            <Button
              variant={ButtonVariant.SECONDARY}
              size={ButtonSize.MEDIUM}
              onClick={onSettingsClick}
              ariaLabel="Open settings"
              data-testid="settings-button"
            >
              <Icon
                type={IconType.UI}
                name="settings"
                size={IconSize.SMALL}
                ariaLabel="Settings icon"
              />
            </Button>
          )}
          
          {children}
        </StyledNav>
      </StyledHeader>
    </ErrorBoundary>
  );
});

Header.displayName = 'Header';

export default Header;
import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { DashboardLayoutProps } from './DashboardLayout.types';
import { Header } from '../../dashboard/Header/Header';
import { useWebSocket } from '../../../contexts/WebSocketContext';
import { WebSocketConnectionState } from '../../../types/websocket.types';

// Styled components with theme integration
const StyledLayout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: ${({ theme }) => theme.colors.background};
  transition: background-color 0.3s ease;
  position: relative;
  overflow: hidden;
  
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledMain = styled.main<{ $sidebarCollapsed: boolean }>`
  display: flex;
  flex: 1;
  margin-left: ${({ $sidebarCollapsed }) => $sidebarCollapsed ? '64px' : '280px'};
  transition: margin-left 0.3s ease;
  
  @media (max-width: 768px) {
    margin-left: 0;
  }
  
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  
  will-change: margin-left;
  position: relative;
  z-index: 1;
`;

const StyledContent = styled.div`
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  position: relative;
  
  @media (max-width: 768px) {
    padding: 16px;
  }
  
  /* Scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background};
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: 4px;
  }
`;

const StyledSidebar = styled.aside<{ $collapsed: boolean }>`
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: ${({ $collapsed }) => $collapsed ? '64px' : '280px'};
  background-color: ${({ theme }) => theme.colors.background};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  transition: width 0.3s ease;
  z-index: 2;
  
  @media (max-width: 768px) {
    transform: translateX(${({ $collapsed }) => $collapsed ? '-100%' : '0'});
  }
  
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/**
 * DashboardLayout component implementing the main application layout structure
 * with responsive behavior and accessibility enhancements
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className
}) => {
  // Get WebSocket connection state
  const { connectionState } = useWebSocket();
  
  // Responsive layout management
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('dashboard_sidebar_collapsed');
    return isMobile ? true : stored === 'true';
  });

  // Update sidebar state when screen size changes
  useEffect(() => {
    if (isMobile) {
      setIsSidebarCollapsed(true);
    }
  }, [isMobile]);

  // Handle sidebar toggle with performance optimization
  const handleSidebarToggle = useCallback(() => {
    requestAnimationFrame(() => {
      setIsSidebarCollapsed(prev => {
        const newState = !prev;
        localStorage.setItem('dashboard_sidebar_collapsed', String(newState));
        return newState;
      });
    });
  }, []);

  // Handle settings navigation
  const handleSettingsClick = useCallback(() => {
    // Implementation will be handled by routing system
    console.log('Navigate to settings');
  }, []);

  // Handle floor plan changes
  const handleFloorChange = useCallback((floorId: string) => {
    // Implementation will be handled by floor plan manager
    console.log('Floor changed:', floorId);
  }, []);

  // Sync sidebar state across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dashboard_sidebar_collapsed') {
        setIsSidebarCollapsed(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <StyledLayout className={className}>
      <Header
        connectionState={connectionState}
        onFloorChange={handleFloorChange}
        onSettingsClick={handleSettingsClick}
        data-testid="dashboard-header"
      />
      
      <StyledSidebar
        $collapsed={isSidebarCollapsed}
        role="complementary"
        aria-label="Dashboard navigation"
        data-testid="dashboard-sidebar"
      >
        {/* Sidebar content will be injected here */}
      </StyledSidebar>
      
      <StyledMain
        $sidebarCollapsed={isSidebarCollapsed}
        role="main"
        data-testid="dashboard-main"
      >
        <StyledContent>
          {children}
        </StyledContent>
      </StyledMain>
      
      {isMobile && !isSidebarCollapsed && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={handleSidebarToggle}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1
          }}
          data-testid="sidebar-overlay"
        />
      )}
    </StyledLayout>
  );
};

export default DashboardLayout;
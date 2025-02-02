import React, { useCallback, useState, useEffect, useMemo } from 'react';
import styled, { css } from 'styled-components';
import { SidebarProps, FloorPlanSectionProps, SIDEBAR_SECTIONS } from './Sidebar.types';
import { Icon } from '../../common/Icon/Icon';
import { IconType, IconSize } from '../../common/Icon/Icon.types';
import { useFloorPlan } from '../../../hooks/useFloorPlan';
import { PERFORMANCE_THRESHOLDS, UI_CONSTANTS } from '../../../config/constants';

// Styled components with theme support and accessibility
const StyledSidebar = styled.aside<{ $isCollapsed: boolean; $theme: string }>`
  position: fixed;
  left: 0;
  top: 64px; // Header height
  bottom: 0;
  width: ${props => props.$isCollapsed ? '64px' : '280px'};
  background: ${props => props.theme.colors.background};
  border-right: 1px solid ${props => props.theme.colors.border};
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 100;
  box-shadow: ${props => props.theme.colors.mode === 'dark' ? '2px 0 8px rgba(0, 0, 0, 0.2)' : '2px 0 8px rgba(0, 0, 0, 0.1)'};

  @media (max-width: 768px) {
    width: ${props => props.$isCollapsed ? '0' : '100%'};
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const SidebarContent = styled.div`
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${props => props.theme.colors.secondary} transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: ${props => props.theme.colors.secondary};
    border-radius: 3px;
  }
`;

const SectionHeader = styled.div<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background: ${props => props.$isActive ? props.theme.colors.primary + '20' : 'transparent'};
  color: ${props => props.theme.colors.text};
  transition: background-color 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.primary + '10'};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: -2px;
  }
`;

const SectionContent = styled.div<{ $isVisible: boolean }>`
  max-height: ${props => props.$isVisible ? '100%' : '0'};
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

const FloorPlanList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const FloorPlanItem = styled.li<{ $isActive: boolean }>`
  padding: 8px 16px 8px 32px;
  cursor: pointer;
  background: ${props => props.$isActive ? props.theme.colors.primary + '20' : 'transparent'};
  color: ${props => props.theme.colors.text};
  transition: background-color 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.primary + '10'};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: -2px;
  }
`;

const CollapseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  color: ${props => props.theme.colors.text};
  transition: transform 0.3s ease;

  &:hover {
    color: ${props => props.theme.colors.primary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`;

const Sidebar: React.FC<SidebarProps> = ({
  children,
  className,
  theme = 'light',
  initialCollapsed = false,
  onCollapsedChange
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [activeSection, setActiveSection] = useState<string>(SIDEBAR_SECTIONS.FLOOR_PLANS);
  const { floorPlans, activeFloorPlan, setActiveFloorPlan, error } = useFloorPlan();

  // Performance monitoring
  const startTime = useMemo(() => performance.now(), []);

  useEffect(() => {
    const renderTime = performance.now() - startTime;
    if (renderTime > PERFORMANCE_THRESHOLDS.maxResponseTime) {
      console.warn(`Sidebar render took ${renderTime}ms`);
    }
  }, [startTime]);

  // Handle sidebar collapse
  const handleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const newState = !prev;
      onCollapsedChange?.(newState);
      return newState;
    });
  }, [onCollapsedChange]);

  // Handle section toggle
  const handleSectionToggle = useCallback((section: string) => {
    setActiveSection(prev => prev === section ? '' : section);
  }, []);

  // Handle floor plan selection
  const handleFloorPlanSelect = useCallback((id: string) => {
    const startTime = performance.now();
    setActiveFloorPlan(id).catch(error => {
      console.error('Failed to set active floor plan:', error);
    });
    const selectionTime = performance.now() - startTime;
    if (selectionTime > PERFORMANCE_THRESHOLDS.maxResponseTime) {
      console.warn(`Floor plan selection took ${selectionTime}ms`);
    }
  }, [setActiveFloorPlan]);

  // Render floor plans section
  const renderFloorPlans = useCallback(() => {
    return (
      <FloorPlanList role="list">
        {Array.from(floorPlans.values())
          .sort((a, b) => a.order - b.order)
          .map(plan => (
            <FloorPlanItem
              key={plan.id}
              $isActive={plan.id === activeFloorPlan}
              onClick={() => handleFloorPlanSelect(plan.id)}
              role="listitem"
              tabIndex={0}
              aria-selected={plan.id === activeFloorPlan}
              onKeyPress={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleFloorPlanSelect(plan.id);
                }
              }}
            >
              {plan.name}
            </FloorPlanItem>
          ))}
      </FloorPlanList>
    );
  }, [floorPlans, activeFloorPlan, handleFloorPlanSelect]);

  return (
    <StyledSidebar
      $isCollapsed={isCollapsed}
      $theme={theme}
      className={className}
      role="complementary"
      aria-label="Dashboard sidebar"
    >
      <SidebarHeader>
        <CollapseButton
          onClick={handleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <Icon
            name={isCollapsed ? 'chevron-right' : 'chevron-left'}
            type={IconType.UI}
            size={IconSize.MEDIUM}
          />
        </CollapseButton>
      </SidebarHeader>

      <SidebarContent>
        <SectionHeader
          $isActive={activeSection === SIDEBAR_SECTIONS.FLOOR_PLANS}
          onClick={() => handleSectionToggle(SIDEBAR_SECTIONS.FLOOR_PLANS)}
          role="button"
          aria-expanded={activeSection === SIDEBAR_SECTIONS.FLOOR_PLANS}
          tabIndex={0}
        >
          <Icon
            name="floor-plan"
            type={IconType.UI}
            size={IconSize.SMALL}
          />
          {!isCollapsed && <span style={{ marginLeft: '8px' }}>Floor Plans</span>}
        </SectionHeader>

        <SectionContent $isVisible={activeSection === SIDEBAR_SECTIONS.FLOOR_PLANS}>
          {renderFloorPlans()}
        </SectionContent>

        {children}
      </SidebarContent>
    </StyledSidebar>
  );
};

Sidebar.displayName = 'Sidebar';

export default React.memo(Sidebar);
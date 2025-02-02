import React, { useCallback, useEffect, useState, useMemo } from 'react';
import styled from 'styled-components';
import { ErrorBoundary } from 'react-error-boundary';

import { DashboardProps, DashboardState, ConnectionState } from './Dashboard.types';
import { FloorPlan } from '../../components/dashboard/FloorPlan/FloorPlan';
import { EntityList } from '../../components/dashboard/EntityList/EntityList';
import { useFloorPlan } from '../../hooks/useFloorPlan';
import { useEntity } from '../../hooks/useEntity';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// Styled components for dashboard layout
const StyledDashboard = styled.div`
  display: grid;
  grid-template-columns: minmax(300px, 25%) 1fr;
  height: 100vh;
  overflow: hidden;
  background: var(--background-color);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
`;

const MainContent = styled.main`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
`;

const ConnectionIndicator = styled.div<{ $status: ConnectionState }>`
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 100;
  background: ${props => 
    props.$status === ConnectionState.CONNECTED ? 'var(--success-color)' :
    props.$status === ConnectionState.CONNECTING ? 'var(--warning-color)' :
    'var(--error-color)'};
  color: white;
  transition: background-color 0.3s ease;
`;

const ErrorMessage = styled.div`
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  padding: 16px;
  background: var(--error-background);
  color: var(--error-color);
  border-radius: 4px;
  z-index: 100;
`;

const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  // State management
  const [state, setState] = useState<DashboardState>({
    activeFloorPlanId: null,
    selectedEntityId: null,
    entityFilter: null,
    isControlDialogOpen: false,
    error: null,
    connectionStatus: ConnectionState.CONNECTING,
    lastUpdateTimestamp: Date.now(),
    performanceMetrics: {
      renderTime: 0,
      stateUpdateLatency: 0,
      entityUpdateCount: 0,
      lastInteractionTime: Date.now(),
      frameRate: 60,
      wsLatency: 0,
      memoryUsage: 0
    }
  });

  // Custom hooks
  const {
    floorPlans,
    activeFloorPlan,
    loading,
    error: floorPlanError,
    updateEntityPosition,
    subscribeToUpdates
  } = useFloorPlan();

  // Performance monitoring
  const startRenderTime = performance.now();

  useEffect(() => {
    const renderTime = performance.now() - startRenderTime;
    if (renderTime > PERFORMANCE_THRESHOLDS.maxResponseTime) {
      console.warn(`Dashboard render exceeded threshold: ${renderTime}ms`);
    }

    setState(prev => ({
      ...prev,
      performanceMetrics: {
        ...prev.performanceMetrics,
        renderTime
      }
    }));
  }, []);

  // Entity drag and drop handling
  const handleEntityDrop = useCallback(async (entityId: string, position: { x: number; y: number }) => {
    const startTime = performance.now();
    try {
      if (!activeFloorPlan) return;

      await updateEntityPosition(activeFloorPlan.id, entityId, position);
      
      const dropTime = performance.now() - startTime;
      setState(prev => ({
        ...prev,
        performanceMetrics: {
          ...prev.performanceMetrics,
          lastInteractionTime: Date.now(),
          stateUpdateLatency: dropTime
        }
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to update entity position')
      }));
    }
  }, [activeFloorPlan, updateEntityPosition]);

  // Entity selection handling
  const handleEntitySelect = useCallback((entityId: string) => {
    setState(prev => ({
      ...prev,
      selectedEntityId: entityId,
      isControlDialogOpen: true,
      performanceMetrics: {
        ...prev.performanceMetrics,
        lastInteractionTime: Date.now()
      }
    }));
  }, []);

  // Floor plan zoom handling
  const handleZoom = useCallback((scale: number) => {
    setState(prev => ({
      ...prev,
      performanceMetrics: {
        ...prev.performanceMetrics,
        lastInteractionTime: Date.now()
      }
    }));
  }, []);

  // Error handling
  const handleError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      error,
      performanceMetrics: {
        ...prev.performanceMetrics,
        errorCount: (prev.performanceMetrics.errorCount || 0) + 1
      }
    }));
  }, []);

  // Subscribe to entity updates
  useEffect(() => {
    const unsubscribe = subscribeToUpdates((entityId, timestamp) => {
      setState(prev => ({
        ...prev,
        lastUpdateTimestamp: timestamp,
        performanceMetrics: {
          ...prev.performanceMetrics,
          entityUpdateCount: prev.performanceMetrics.entityUpdateCount + 1
        }
      }));
    });

    return () => unsubscribe();
  }, [subscribeToUpdates]);

  // Memoized entity list
  const filteredEntities = useMemo(() => {
    if (!activeFloorPlan) return [];
    return Array.from(activeFloorPlan.entityPlacements.keys());
  }, [activeFloorPlan]);

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <ErrorMessage>
          {error.message}
        </ErrorMessage>
      )}
      onError={handleError}
    >
      <StyledDashboard className={className}>
        <EntityList
          entities={filteredEntities}
          selectedType={state.entityFilter}
          searchQuery=""
          onDragStart={(entity, event) => {
            event.dataTransfer.setData('entity_id', entity.entity_id);
          }}
          onSelect={handleEntitySelect}
          virtualized
        />

        <MainContent>
          <ConnectionIndicator $status={state.connectionStatus}>
            {state.connectionStatus}
          </ConnectionIndicator>

          {activeFloorPlan && (
            <FloorPlan
              floorPlan={activeFloorPlan}
              onEntityDrop={handleEntityDrop}
              onZoom={handleZoom}
              onStateUpdate={(entityId, newState) => {
                setState(prev => ({
                  ...prev,
                  lastUpdateTimestamp: Date.now()
                }));
              }}
              onError={handleError}
              isLoading={loading}
            />
          )}

          {state.error && (
            <ErrorMessage>
              {state.error.message}
            </ErrorMessage>
          )}
        </MainContent>
      </StyledDashboard>
    </ErrorBoundary>
  );
};

export default React.memo(Dashboard);
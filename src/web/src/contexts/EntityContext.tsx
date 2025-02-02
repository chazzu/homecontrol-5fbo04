/**
 * EntityContext - React Context provider for managing smart home entity states
 * Implements high-performance state synchronization with Home Assistant
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { HassEntity } from 'home-assistant-js-websocket'; // v8.0.1
import { EntityType, EntityConfig, ConnectionState, EntityContextState } from '../types/entity.types';
import { EntityService } from '../services/entity';
import { PERFORMANCE_THRESHOLDS, ERROR_CODES } from '../config/constants';

// Error messages
const CONTEXT_ERROR = 'EntityContext must be used within EntityProvider';
const BATCH_UPDATE_INTERVAL = 100; // ms
const MAX_RECONNECT_ATTEMPTS = 5;

interface EntityContextProps {
  children: React.ReactNode;
  entityService: EntityService;
  batchUpdateInterval?: number;
  reconnectAttempts?: number;
}

interface PerformanceMetrics {
  lastUpdateLatency: number;
  averageLatency: number;
  updateCount: number;
  errorCount: number;
}

interface EntityContextValue extends EntityContextState {
  // Entity Management
  getEntityState: (entityId: string) => HassEntity | null;
  getEntityConfig: (entityId: string) => EntityConfig | null;
  updateEntityConfig: (entityId: string, config: Partial<EntityConfig>) => Promise<void>;
  sendCommand: (entityId: string, command: string, data?: Record<string, unknown>) => Promise<void>;
  batchUpdate: (updates: Array<{ entityId: string; state: HassEntity }>) => Promise<void>;
  
  // Performance Monitoring
  performanceMetrics: PerformanceMetrics;
}

const defaultPerformanceMetrics: PerformanceMetrics = {
  lastUpdateLatency: 0,
  averageLatency: 0,
  updateCount: 0,
  errorCount: 0,
};

const EntityContext = createContext<EntityContextValue | null>(null);

export const EntityProvider: React.FC<EntityContextProps> = ({
  children,
  entityService,
  batchUpdateInterval = BATCH_UPDATE_INTERVAL,
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS,
}) => {
  // State Management
  const [entities, setEntities] = useState<Map<string, HassEntity>>(new Map());
  const [configurations, setConfigurations] = useState<Map<string, EntityConfig>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [performanceMetrics, setPerformanceMetrics] = useState(defaultPerformanceMetrics);

  // Refs for batch processing
  const batchQueue = useRef<Array<{ entityId: string; state: HassEntity }>>([]);
  const batchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize entity service and state synchronization
  useEffect(() => {
    const initializeContext = async () => {
      try {
        setLoading(true);
        await entityService.initialize();
        setConnectionState(ConnectionState.CONNECTED);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize entity service'));
        setConnectionState(ConnectionState.ERROR);
      } finally {
        setLoading(false);
      }
    };

    initializeContext();

    return () => {
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
    };
  }, [entityService]);

  // Performance monitoring
  const updatePerformanceMetrics = useCallback((latency: number) => {
    setPerformanceMetrics(prev => {
      const newCount = prev.updateCount + 1;
      const newAverage = ((prev.averageLatency * prev.updateCount) + latency) / newCount;
      return {
        lastUpdateLatency: latency,
        averageLatency: newAverage,
        updateCount: newCount,
        errorCount: prev.errorCount,
      };
    });
  }, []);

  // Entity state management
  const getEntityState = useCallback((entityId: string): HassEntity | null => {
    return entities.get(entityId) || null;
  }, [entities]);

  const getEntityConfig = useCallback((entityId: string): EntityConfig | null => {
    return configurations.get(entityId) || null;
  }, [configurations]);

  const updateEntityConfig = useCallback(async (
    entityId: string,
    config: Partial<EntityConfig>
  ): Promise<void> => {
    try {
      const currentConfig = configurations.get(entityId);
      if (!currentConfig) {
        throw new Error(`No configuration found for entity: ${entityId}`);
      }

      const updatedConfig = { ...currentConfig, ...config };
      await entityService.setEntityConfig(entityId, updatedConfig);

      setConfigurations(prev => new Map(prev).set(entityId, updatedConfig));
    } catch (err) {
      setPerformanceMetrics(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      throw err;
    }
  }, [configurations, entityService]);

  const sendCommand = useCallback(async (
    entityId: string,
    command: string,
    data: Record<string, unknown> = {}
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      await entityService.controlEntity(entityId, command, data);
      const latency = Date.now() - startTime;
      updatePerformanceMetrics(latency);

      if (latency > PERFORMANCE_THRESHOLDS.maxSyncLatency) {
        console.warn(`Command latency exceeded threshold: ${latency}ms`);
      }
    } catch (err) {
      setPerformanceMetrics(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      throw err;
    }
  }, [entityService, updatePerformanceMetrics]);

  const processBatchUpdate = useCallback(async () => {
    if (batchQueue.current.length === 0) return;

    const startTime = Date.now();
    const updates = [...batchQueue.current];
    batchQueue.current = [];

    try {
      const updatedEntities = new Map(entities);
      updates.forEach(({ entityId, state }) => {
        updatedEntities.set(entityId, state);
      });

      setEntities(updatedEntities);
      setLastUpdate(Date.now());

      const latency = Date.now() - startTime;
      updatePerformanceMetrics(latency);

      if (latency > PERFORMANCE_THRESHOLDS.maxSyncLatency) {
        console.warn(`Batch update latency exceeded threshold: ${latency}ms`);
      }
    } catch (err) {
      setPerformanceMetrics(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      console.error('Failed to process batch update:', err);
    }
  }, [entities, updatePerformanceMetrics]);

  const batchUpdate = useCallback(async (
    updates: Array<{ entityId: string; state: HassEntity }>
  ): Promise<void> => {
    batchQueue.current.push(...updates);

    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    batchTimeout.current = setTimeout(() => {
      processBatchUpdate();
    }, batchUpdateInterval);
  }, [batchUpdateInterval, processBatchUpdate]);

  // Subscribe to entity updates
  useEffect(() => {
    const unsubscribe = entityService.subscribeToEntity('*', (entityId, state) => {
      batchUpdate([{ entityId, state }]);
    });

    return () => {
      unsubscribe();
    };
  }, [entityService, batchUpdate]);

  const contextValue: EntityContextValue = {
    entities,
    configurations,
    loading,
    error,
    connectionState,
    lastUpdate,
    performanceMetrics,
    getEntityState,
    getEntityConfig,
    updateEntityConfig,
    sendCommand,
    batchUpdate,
  };

  return (
    <EntityContext.Provider value={contextValue}>
      {children}
    </EntityContext.Provider>
  );
};

export const useEntityContext = (): EntityContextValue => {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error(CONTEXT_ERROR);
  }
  return context;
};

export default EntityContext;
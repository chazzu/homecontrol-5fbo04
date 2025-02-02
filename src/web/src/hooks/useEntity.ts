/**
 * Custom React hook for managing smart home entity states and interactions
 * Provides optimized access to entity data with enhanced error handling
 * @version 1.0.0
 */

import { useCallback, useMemo } from 'react'; // v18.0.0
import { useEntityContext } from '../contexts/EntityContext';
import { EntityType, EntityConfig } from '../types/entity.types';
import { PERFORMANCE_THRESHOLDS, ERROR_CODES } from '../config/constants';

/**
 * Interface for entity command options with timeout handling
 */
interface CommandOptions {
  /** Command timeout in milliseconds */
  timeout?: number;
  /** Retry attempts for failed commands */
  retries?: number;
  /** Whether to wait for state update confirmation */
  waitForUpdate?: boolean;
}

/**
 * Default command options aligned with performance requirements
 */
const DEFAULT_COMMAND_OPTIONS: CommandOptions = {
  timeout: PERFORMANCE_THRESHOLDS.maxSyncLatency,
  retries: 3,
  waitForUpdate: true
};

/**
 * Custom hook for managing entity state and interactions
 * @param entityId - Unique identifier of the entity
 * @returns Object containing entity state and control methods
 */
export const useEntity = (entityId: string) => {
  const {
    getEntityState,
    getEntityConfig,
    updateEntityConfig,
    sendCommand,
    performanceMetrics
  } = useEntityContext();

  /**
   * Memoized entity state with type checking
   */
  const state = useMemo(() => {
    const currentState = getEntityState(entityId);
    if (!currentState) return null;
    return currentState;
  }, [entityId, getEntityState]);

  /**
   * Memoized entity configuration with validation
   */
  const config = useMemo(() => {
    const currentConfig = getEntityConfig(entityId);
    if (!currentConfig) return null;
    return currentConfig;
  }, [entityId, getEntityConfig]);

  /**
   * Updates entity configuration with validation and error handling
   */
  const updateConfig = useCallback(async (
    updates: Partial<EntityConfig>
  ): Promise<void> => {
    if (!config) {
      throw new Error(`No configuration found for entity: ${entityId}`);
    }

    const startTime = Date.now();
    try {
      await updateEntityConfig(entityId, updates);
      
      const updateTime = Date.now() - startTime;
      if (updateTime > PERFORMANCE_THRESHOLDS.maxResponseTime) {
        console.warn(`Config update exceeded performance threshold: ${updateTime}ms`);
      }
    } catch (error) {
      console.error('Failed to update entity configuration:', error);
      throw error;
    }
  }, [entityId, config, updateEntityConfig]);

  /**
   * Sends command to entity with enhanced error handling and retry logic
   */
  const sendEntityCommand = useCallback(async (
    command: string,
    data: Record<string, any> = {},
    options: CommandOptions = DEFAULT_COMMAND_OPTIONS
  ): Promise<void> => {
    if (!config) {
      throw new Error(`No configuration found for entity: ${entityId}`);
    }

    const startTime = Date.now();
    let attempts = 0;

    while (attempts <= (options.retries ?? DEFAULT_COMMAND_OPTIONS.retries!)) {
      try {
        await Promise.race([
          sendCommand(entityId, command, data),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Command timeout after ${options.timeout}ms`));
            }, options.timeout ?? DEFAULT_COMMAND_OPTIONS.timeout);
          })
        ]);

        const commandTime = Date.now() - startTime;
        if (commandTime > PERFORMANCE_THRESHOLDS.maxSyncLatency) {
          console.warn(`Command execution exceeded latency threshold: ${commandTime}ms`);
        }

        return;
      } catch (error) {
        attempts++;
        if (attempts > (options.retries ?? DEFAULT_COMMAND_OPTIONS.retries!)) {
          console.error('Command failed after retries:', error);
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }, [entityId, config, sendCommand]);

  /**
   * Checks if entity supports a specific feature based on its type
   */
  const supportsFeature = useCallback((feature: string): boolean => {
    if (!config) return false;

    const featureMap: Record<EntityType, string[]> = {
      [EntityType.LIGHT]: ['brightness', 'color', 'color_temp'],
      [EntityType.SWITCH]: ['toggle'],
      [EntityType.CLIMATE]: ['temperature', 'mode', 'fan'],
      [EntityType.MEDIA_PLAYER]: ['play', 'pause', 'volume'],
      [EntityType.SENSOR]: ['state'],
      [EntityType.BINARY_SENSOR]: ['state'],
      [EntityType.CAMERA]: ['stream', 'snapshot'],
      [EntityType.COVER]: ['position', 'tilt'],
      [EntityType.FAN]: ['speed', 'oscillate'],
      [EntityType.LOCK]: ['lock', 'unlock']
    };

    return featureMap[config.type]?.includes(feature) ?? false;
  }, [config]);

  /**
   * Returns current performance metrics for the entity
   */
  const getPerformanceMetrics = useCallback(() => {
    return {
      lastUpdateLatency: performanceMetrics.lastUpdateLatency,
      averageLatency: performanceMetrics.averageLatency,
      errorCount: performanceMetrics.errorCount
    };
  }, [performanceMetrics]);

  return {
    /** Current entity state */
    state,
    /** Entity configuration */
    config,
    /** Update entity configuration */
    updateConfig,
    /** Send command to entity */
    sendCommand: sendEntityCommand,
    /** Check feature support */
    supportsFeature,
    /** Get performance metrics */
    getPerformanceMetrics
  };
};

export default useEntity;
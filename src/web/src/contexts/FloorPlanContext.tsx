import React, { createContext, useState, useEffect, useCallback, useRef } from 'react'; // v18.0.0
import { FloorPlan, FloorPlanUploadData, FloorPlanError } from '../types/floorPlan.types';
import { FloorPlanService } from '../services/floorPlan';
import { STORAGE_KEYS, PERFORMANCE_THRESHOLDS } from '../config/constants';

/**
 * Default context value with comprehensive error handling
 */
const DEFAULT_CONTEXT_VALUE = {
  floorPlans: new Map<string, FloorPlan>(),
  activeFloorPlan: null as string | null,
  loading: false,
  error: null as FloorPlanError | null,
  isSyncing: false,
  lastSyncTimestamp: 0,
  setActiveFloorPlan: async () => { throw new Error('Context not initialized') },
  createFloorPlan: async () => { throw new Error('Context not initialized') },
  updateFloorPlan: async () => { throw new Error('Context not initialized') },
  deleteFloorPlan: async () => { throw new Error('Context not initialized') },
  updateEntityPlacement: async () => { throw new Error('Context not initialized') },
  removeEntityPlacement: async () => { throw new Error('Context not initialized') },
  syncState: async () => { throw new Error('Context not initialized') },
  clearError: () => { throw new Error('Context not initialized') }
};

/**
 * Floor Plan Context with enhanced error handling and performance monitoring
 */
export const FloorPlanContext = createContext(DEFAULT_CONTEXT_VALUE);

/**
 * Props interface for FloorPlanProvider
 */
interface FloorPlanProviderProps {
  children: React.ReactNode;
}

/**
 * FloorPlanProvider component that manages floor plan state and operations
 */
export const FloorPlanProvider: React.FC<FloorPlanProviderProps> = ({ children }) => {
  // Initialize state with comprehensive error handling
  const [floorPlans, setFloorPlans] = useState<Map<string, FloorPlan>>(new Map());
  const [activeFloorPlan, setActiveFloorPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FloorPlanError | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(0);

  // Service and performance monitoring references
  const floorPlanService = useRef(new FloorPlanService());
  const performanceMetrics = useRef({
    lastOperationStart: 0,
    operationsCount: 0
  });

  /**
   * Initialize floor plans and set up storage event listeners
   */
  useEffect(() => {
    const initializeFloorPlans = async () => {
      try {
        setLoading(true);
        const plans = await floorPlanService.current.getFloorPlans();
        setFloorPlans(plans);
      } catch (error) {
        handleError('Failed to initialize floor plans', error);
      } finally {
        setLoading(false);
      }
    };

    // Set up storage event listener for cross-tab synchronization
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.floorPlans && event.newValue) {
        syncState();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    initializeFloorPlans();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  /**
   * Handle errors with detailed information
   */
  const handleError = (message: string, error: unknown) => {
    const floorPlanError: FloorPlanError = {
      code: 'FLOOR_PLAN_ERROR',
      message: `${message}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { originalError: error }
    };
    setError(floorPlanError);
    console.error('Floor Plan Error:', floorPlanError);
  };

  /**
   * Synchronize state with storage and other tabs
   */
  const syncState = useCallback(async () => {
    try {
      setIsSyncing(true);
      const startTime = performance.now();
      
      const plans = await floorPlanService.current.getFloorPlans();
      setFloorPlans(plans);
      setLastSyncTimestamp(Date.now());

      const duration = performance.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLDS.maxSyncLatency) {
        console.warn(`Floor plan sync took ${duration}ms`);
      }
    } catch (error) {
      handleError('Failed to sync floor plans', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Set active floor plan with validation
   */
  const handleSetActiveFloorPlan = useCallback(async (id: string) => {
    try {
      if (!floorPlans.has(id)) {
        throw new Error('Floor plan not found');
      }
      setActiveFloorPlan(id);
    } catch (error) {
      handleError('Failed to set active floor plan', error);
    }
  }, [floorPlans]);

  /**
   * Create new floor plan with optimistic updates
   */
  const handleCreateFloorPlan = useCallback(async (data: FloorPlanUploadData): Promise<FloorPlan> => {
    try {
      performanceMetrics.current.lastOperationStart = performance.now();
      const newFloorPlan = await floorPlanService.current.createFloorPlan(data);
      
      setFloorPlans(prev => {
        const updated = new Map(prev);
        updated.set(newFloorPlan.id, newFloorPlan);
        return updated;
      });

      return newFloorPlan;
    } catch (error) {
      handleError('Failed to create floor plan', error);
      throw error;
    }
  }, []);

  /**
   * Update floor plan with optimistic updates
   */
  const handleUpdateFloorPlan = useCallback(async (id: string, updates: Partial<FloorPlan>): Promise<FloorPlan> => {
    try {
      performanceMetrics.current.lastOperationStart = performance.now();
      const updatedPlan = await floorPlanService.current.updateFloorPlan(id, updates);
      
      setFloorPlans(prev => {
        const updated = new Map(prev);
        updated.set(id, updatedPlan);
        return updated;
      });

      return updatedPlan;
    } catch (error) {
      handleError('Failed to update floor plan', error);
      throw error;
    }
  }, []);

  /**
   * Delete floor plan with optimistic updates
   */
  const handleDeleteFloorPlan = useCallback(async (id: string): Promise<void> => {
    try {
      performanceMetrics.current.lastOperationStart = performance.now();
      await floorPlanService.current.deleteFloorPlan(id);
      
      setFloorPlans(prev => {
        const updated = new Map(prev);
        updated.delete(id);
        return updated;
      });

      if (activeFloorPlan === id) {
        setActiveFloorPlan(null);
      }
    } catch (error) {
      handleError('Failed to delete floor plan', error);
      throw error;
    }
  }, [activeFloorPlan]);

  /**
   * Update entity placement with optimistic updates
   */
  const handleUpdateEntityPlacement = useCallback(async (
    floorPlanId: string,
    entityId: string,
    position: { x: number; y: number; scale?: number; rotation?: number }
  ): Promise<void> => {
    try {
      performanceMetrics.current.lastOperationStart = performance.now();
      await floorPlanService.current.updateEntityPlacement(floorPlanId, entityId, position);
      
      setFloorPlans(prev => {
        const updated = new Map(prev);
        const plan = updated.get(floorPlanId);
        if (plan) {
          plan.entityPlacements.set(entityId, {
            x: position.x,
            y: position.y,
            scale: position.scale || 1,
            rotation: position.rotation || 0
          });
        }
        return updated;
      });
    } catch (error) {
      handleError('Failed to update entity placement', error);
      throw error;
    }
  }, []);

  /**
   * Remove entity placement with optimistic updates
   */
  const handleRemoveEntityPlacement = useCallback(async (
    floorPlanId: string,
    entityId: string
  ): Promise<void> => {
    try {
      performanceMetrics.current.lastOperationStart = performance.now();
      await floorPlanService.current.removeEntity(floorPlanId, entityId);
      
      setFloorPlans(prev => {
        const updated = new Map(prev);
        const plan = updated.get(floorPlanId);
        if (plan) {
          plan.entityPlacements.delete(entityId);
        }
        return updated;
      });
    } catch (error) {
      handleError('Failed to remove entity placement', error);
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context value with memoized handlers
  const contextValue = {
    floorPlans,
    activeFloorPlan,
    loading,
    error,
    isSyncing,
    lastSyncTimestamp,
    setActiveFloorPlan: handleSetActiveFloorPlan,
    createFloorPlan: handleCreateFloorPlan,
    updateFloorPlan: handleUpdateFloorPlan,
    deleteFloorPlan: handleDeleteFloorPlan,
    updateEntityPlacement: handleUpdateEntityPlacement,
    removeEntityPlacement: handleRemoveEntityPlacement,
    syncState,
    clearError
  };

  return (
    <FloorPlanContext.Provider value={contextValue}>
      {children}
    </FloorPlanContext.Provider>
  );
};
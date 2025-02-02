import { useContext, useCallback } from 'react'; // v18.0.0
import { FloorPlanContext } from '../contexts/FloorPlanContext';
import { FloorPlan } from '../types/floorPlan.types';
import { PERFORMANCE_THRESHOLDS } from '../config/constants';

/**
 * Interface for the useFloorPlan hook return value
 */
interface UseFloorPlanReturn {
  /** Map of all floor plans indexed by ID */
  floorPlans: Map<string, FloorPlan>;
  /** Currently active floor plan */
  activeFloorPlan: FloorPlan | null;
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Indicates if state is being synchronized */
  isSyncing: boolean;
  /** Timestamp of last synchronization */
  lastSyncTimestamp: number;
  /** Sets the active floor plan */
  setActiveFloorPlan: (id: string) => Promise<void>;
  /** Creates a new floor plan */
  createFloorPlan: (data: FloorPlanUploadData) => Promise<FloorPlan>;
  /** Updates an existing floor plan */
  updateFloorPlan: (id: string, updates: Partial<FloorPlan>) => Promise<FloorPlan>;
  /** Deletes a floor plan */
  deleteFloorPlan: (id: string) => Promise<void>;
  /** Updates entity placement on floor plan */
  updateEntityPlacement: (
    floorPlanId: string,
    entityId: string,
    position: { x: number; y: number; scale?: number; rotation?: number }
  ) => Promise<void>;
  /** Removes entity from floor plan */
  removeEntityPlacement: (floorPlanId: string, entityId: string) => Promise<void>;
  /** Synchronizes floor plan state */
  syncState: () => Promise<void>;
  /** Clears any error state */
  clearError: () => void;
}

/**
 * Custom hook for accessing and managing floor plans through FloorPlanContext
 * with enhanced error handling and performance optimizations
 */
export function useFloorPlan(): UseFloorPlanReturn {
  const context = useContext(FloorPlanContext);

  // Validate context availability
  if (!context) {
    throw new Error('useFloorPlan must be used within a FloorPlanProvider');
  }

  const {
    floorPlans,
    activeFloorPlan: activeFloorPlanId,
    loading,
    error,
    isSyncing,
    lastSyncTimestamp,
    setActiveFloorPlan,
    createFloorPlan,
    updateFloorPlan,
    deleteFloorPlan,
    updateEntityPlacement,
    removeEntityPlacement,
    syncState,
    clearError
  } = context;

  /**
   * Get active floor plan with performance monitoring
   */
  const getActiveFloorPlan = useCallback((): FloorPlan | null => {
    const startTime = performance.now();
    
    const plan = activeFloorPlanId ? floorPlans.get(activeFloorPlanId) || null : null;
    
    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.maxResponseTime) {
      console.warn(`Active floor plan retrieval took ${duration}ms`);
    }
    
    return plan;
  }, [activeFloorPlanId, floorPlans]);

  /**
   * Memoized floor plan operations with error boundaries
   */
  const memoizedOperations = {
    setActiveFloorPlan: useCallback(async (id: string) => {
      try {
        await setActiveFloorPlan(id);
      } catch (error) {
        console.error('Failed to set active floor plan:', error);
        throw error;
      }
    }, [setActiveFloorPlan]),

    createFloorPlan: useCallback(async (data: FloorPlanUploadData) => {
      try {
        return await createFloorPlan(data);
      } catch (error) {
        console.error('Failed to create floor plan:', error);
        throw error;
      }
    }, [createFloorPlan]),

    updateFloorPlan: useCallback(async (id: string, updates: Partial<FloorPlan>) => {
      try {
        return await updateFloorPlan(id, updates);
      } catch (error) {
        console.error('Failed to update floor plan:', error);
        throw error;
      }
    }, [updateFloorPlan]),

    deleteFloorPlan: useCallback(async (id: string) => {
      try {
        await deleteFloorPlan(id);
      } catch (error) {
        console.error('Failed to delete floor plan:', error);
        throw error;
      }
    }, [deleteFloorPlan]),

    updateEntityPlacement: useCallback(async (
      floorPlanId: string,
      entityId: string,
      position: { x: number; y: number; scale?: number; rotation?: number }
    ) => {
      try {
        await updateEntityPlacement(floorPlanId, entityId, position);
      } catch (error) {
        console.error('Failed to update entity placement:', error);
        throw error;
      }
    }, [updateEntityPlacement]),

    removeEntityPlacement: useCallback(async (floorPlanId: string, entityId: string) => {
      try {
        await removeEntityPlacement(floorPlanId, entityId);
      } catch (error) {
        console.error('Failed to remove entity placement:', error);
        throw error;
      }
    }, [removeEntityPlacement]),

    syncState: useCallback(async () => {
      try {
        await syncState();
      } catch (error) {
        console.error('Failed to sync floor plan state:', error);
        throw error;
      }
    }, [syncState])
  };

  return {
    floorPlans,
    activeFloorPlan: getActiveFloorPlan(),
    loading,
    error,
    isSyncing,
    lastSyncTimestamp,
    ...memoizedOperations,
    clearError
  };
}
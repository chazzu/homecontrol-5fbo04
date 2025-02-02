import { z } from 'zod'; // v3.0.0
import { validateFloorPlan, validateEntityConfig, validatePluginManifest } from './validation';
import { FloorPlan } from '../types/floorPlan.types';
import { EntityConfig } from '../types/entity.types';
import { PluginManifest } from '../types/plugin.types';

// Constants for storage configuration
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit
const STORAGE_VERSION = '1.0';
const STORAGE_KEYS = {
  FLOOR_PLANS: 'floor_plans',
  ENTITY_CONFIG: 'entity_config',
  PLUGIN_DATA: 'plugin_data',
  SETTINGS: 'settings',
  METADATA: '_metadata'
} as const;
const PERFORMANCE_THRESHOLD_MS = 100;

// Types for storage operations
interface StorageMetadata {
  version: string;
  lastUpdated: string;
  size: number;
}

interface StorageStats {
  totalSize: number;
  breakdown: {
    [key: string]: number;
  };
  lastCalculated: string;
}

/**
 * Custom error class for storage operations
 */
class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Measures performance of storage operations
 */
const measureStoragePerformance = <T>(
  operation: () => T,
  operationName: string
): T => {
  const start = performance.now();
  try {
    const result = T = operation();
    const duration = performance.now() - start;
    if (duration > PERFORMANCE_THRESHOLD_MS) {
      console.warn(`Storage operation ${operationName} took ${duration}ms`);
    }
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`Storage operation ${operationName} failed after ${duration}ms:`, error);
    throw error;
  }
};

/**
 * Retrieves and validates an item from localStorage with type safety
 */
export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  return measureStoragePerformance(() => {
    try {
      const rawData = localStorage.getItem(key);
      if (!rawData) return defaultValue;

      const data = JSON.parse(rawData);
      
      // Version check and migration if needed
      const metadata = JSON.parse(localStorage.getItem(STORAGE_KEYS.METADATA) || '{}');
      if (metadata.version !== STORAGE_VERSION) {
        // Implement version migration logic here if needed
        updateMetadata(key, data);
      }

      // Validate data based on key type
      switch (key) {
        case STORAGE_KEYS.FLOOR_PLANS:
          validateFloorPlan(data as FloorPlan);
          break;
        case STORAGE_KEYS.ENTITY_CONFIG:
          validateEntityConfig(data as EntityConfig);
          break;
        case STORAGE_KEYS.PLUGIN_DATA:
          validatePluginManifest(data as PluginManifest);
          break;
      }

      return data as T;
    } catch (error) {
      console.error(`Failed to retrieve storage item ${key}:`, error);
      return defaultValue;
    }
  }, `getStorageItem(${key})`);
};

/**
 * Validates and stores an item in localStorage with size checking
 */
export const setStorageItem = <T>(key: string, value: T): boolean => {
  return measureStoragePerformance(() => {
    try {
      // Validate data based on key type
      switch (key) {
        case STORAGE_KEYS.FLOOR_PLANS:
          validateFloorPlan(value as FloorPlan);
          break;
        case STORAGE_KEYS.ENTITY_CONFIG:
          validateEntityConfig(value as EntityConfig);
          break;
        case STORAGE_KEYS.PLUGIN_DATA:
          validatePluginManifest(value as PluginManifest);
          break;
      }

      const jsonData = JSON.stringify(value);
      const dataSize = new Blob([jsonData]).size;

      // Check item size
      if (dataSize > MAX_STORAGE_SIZE) {
        throw new StorageError(
          'Storage item exceeds size limit',
          'STORAGE_SIZE_EXCEEDED',
          { size: dataSize, limit: MAX_STORAGE_SIZE }
        );
      }

      // Check total storage size
      const currentSize = getStorageSize().totalSize;
      const newTotalSize = currentSize - (getItemSize(key) || 0) + dataSize;
      if (newTotalSize > MAX_STORAGE_SIZE) {
        throw new StorageError(
          'Total storage size would exceed limit',
          'TOTAL_STORAGE_EXCEEDED',
          { currentSize, newSize: newTotalSize, limit: MAX_STORAGE_SIZE }
        );
      }

      localStorage.setItem(key, jsonData);
      updateMetadata(key, value);
      return true;
    } catch (error) {
      console.error(`Failed to store item ${key}:`, error);
      return false;
    }
  }, `setStorageItem(${key})`);
};

/**
 * Removes an item and its associated metadata from localStorage
 */
export const removeStorageItem = (key: string): void => {
  measureStoragePerformance(() => {
    try {
      localStorage.removeItem(key);
      const metadata = JSON.parse(localStorage.getItem(STORAGE_KEYS.METADATA) || '{}');
      delete metadata[key];
      localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error(`Failed to remove storage item ${key}:`, error);
    }
  }, `removeStorageItem(${key})`);
};

/**
 * Clears all dashboard-related items from localStorage
 */
export const clearStorage = (): void => {
  measureStoragePerformance(() => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      // Emit storage cleared event for components to react
      window.dispatchEvent(new Event('dashboardStorageCleared'));
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }, 'clearStorage');
};

/**
 * Calculates the current size of all stored data with detailed breakdown
 */
export const getStorageSize = (): StorageStats => {
  return measureStoragePerformance(() => {
    const breakdown: Record<string, number> = {};
    let totalSize = 0;

    Object.values(STORAGE_KEYS).forEach(key => {
      const size = getItemSize(key);
      if (size) {
        breakdown[key] = size;
        totalSize += size;
      }
    });

    return {
      totalSize,
      breakdown,
      lastCalculated: new Date().toISOString()
    };
  }, 'getStorageSize');
};

/**
 * Updates metadata for a storage item
 */
const updateMetadata = (key: string, value: unknown): void => {
  const metadata = JSON.parse(localStorage.getItem(STORAGE_KEYS.METADATA) || '{}');
  metadata[key] = {
    version: STORAGE_VERSION,
    lastUpdated: new Date().toISOString(),
    size: new Blob([JSON.stringify(value)]).size
  };
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));
};

/**
 * Gets the size of a specific storage item
 */
const getItemSize = (key: string): number => {
  const item = localStorage.getItem(key);
  return item ? new Blob([item]).size : 0;
};
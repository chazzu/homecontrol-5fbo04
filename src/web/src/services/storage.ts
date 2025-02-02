import { z } from 'zod'; // v3.21.4
import { STORAGE_KEYS, STORAGE_LIMITS, ERROR_CODES } from '../config/constants';

/**
 * Version of the storage schema for data migrations
 */
const STORAGE_VERSION = '1.0.0';

/**
 * Custom error class for storage operations
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly code: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Schema definitions for storage validation
 */
const schemas = {
  [STORAGE_KEYS.floorPlans]: z.array(z.object({
    id: z.string(),
    name: z.string(),
    svgData: z.string(),
    dimensions: z.object({
      width: z.number(),
      height: z.number()
    })
  })),
  [STORAGE_KEYS.entityPlacements]: z.array(z.object({
    entityId: z.string(),
    x: z.number(),
    y: z.number(),
    scale: z.number().optional().default(1)
  })),
  [STORAGE_KEYS.pluginData]: z.record(z.string(), z.unknown()),
  [STORAGE_KEYS.entityStates]: z.record(z.string(), z.unknown())
};

/**
 * Service class for managing localStorage operations with validation and error handling
 */
export class StorageService {
  private schemas: Map<string, z.ZodSchema>;
  private sizeLimits: Map<string, number>;
  private version: string;

  constructor() {
    this.schemas = new Map(Object.entries(schemas));
    this.sizeLimits = new Map(Object.entries(STORAGE_LIMITS));
    this.version = STORAGE_VERSION;

    // Initialize storage event listener for cross-tab synchronization
    window.addEventListener('storage', this.handleStorageEvent);
    
    // Validate existing storage on initialization
    this.validateExistingStorage();
  }

  /**
   * Retrieves and validates an item from localStorage
   * @param key Storage key
   * @returns Parsed and validated data or null if not found
   * @throws StorageError if validation fails
   */
  public getItem<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;

      const parsed = JSON.parse(data) as T;
      
      if (this.schemas.has(key)) {
        const schema = this.schemas.get(key)!;
        return schema.parse(parsed) as T;
      }

      return parsed;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new StorageError(
          'Data validation failed',
          key,
          ERROR_CODES.STORAGE.INVALID_DATA,
          error.errors
        );
      }
      throw new StorageError(
        'Failed to retrieve data',
        key,
        ERROR_CODES.STORAGE.INVALID_DATA
      );
    }
  }

  /**
   * Validates and stores an item in localStorage
   * @param key Storage key
   * @param value Data to store
   * @throws StorageError if validation fails or size limit is exceeded
   */
  public setItem<T>(key: string, value: T): void {
    try {
      // Validate data against schema if exists
      if (this.schemas.has(key)) {
        const schema = this.schemas.get(key)!;
        value = schema.parse(value) as T;
      }

      const serialized = JSON.stringify(value);
      
      // Check size limits
      if (this.sizeLimits.has(key)) {
        const limit = this.sizeLimits.get(key)!;
        if (serialized.length > limit) {
          throw new StorageError(
            `Storage quota exceeded for ${key}`,
            key,
            ERROR_CODES.STORAGE.QUOTA_EXCEEDED,
            { size: serialized.length, limit }
          );
        }
      }

      localStorage.setItem(key, serialized);
      
      // Dispatch storage event for cross-tab sync
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: serialized,
        storageArea: localStorage
      }));
    } catch (error) {
      if (error instanceof StorageError) throw error;
      if (error instanceof z.ZodError) {
        throw new StorageError(
          'Data validation failed',
          key,
          ERROR_CODES.STORAGE.INVALID_DATA,
          error.errors
        );
      }
      throw new StorageError(
        'Failed to store data',
        key,
        ERROR_CODES.STORAGE.INVALID_DATA
      );
    }
  }

  /**
   * Removes an item from localStorage
   * @param key Storage key
   */
  public removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  /**
   * Exports all stored data with version information
   * @returns JSON string containing all stored data and version
   */
  public exportData(): string {
    try {
      const export_data: Record<string, unknown> = {
        version: this.version,
        timestamp: new Date().toISOString(),
        data: {}
      };

      for (const key of Object.values(STORAGE_KEYS)) {
        const value = this.getItem(key);
        if (value !== null) {
          export_data.data[key] = value;
        }
      }

      return JSON.stringify(export_data);
    } catch (error) {
      throw new StorageError(
        'Failed to export data',
        'export',
        ERROR_CODES.STORAGE.INVALID_DATA
      );
    }
  }

  /**
   * Imports data from an export string
   * @param exportString Exported data string
   * @throws StorageError if import fails or validation fails
   */
  public importData(exportString: string): void {
    try {
      const importData = JSON.parse(exportString);
      
      if (!importData.version || !importData.data) {
        throw new Error('Invalid export format');
      }

      // Clear existing data before import
      this.clear();

      // Import all valid data
      for (const [key, value] of Object.entries(importData.data)) {
        if (Object.values(STORAGE_KEYS).includes(key)) {
          this.setItem(key, value);
        }
      }
    } catch (error) {
      throw new StorageError(
        'Failed to import data',
        'import',
        ERROR_CODES.STORAGE.INVALID_DATA
      );
    }
  }

  /**
   * Clears all stored data
   */
  public clear(): void {
    localStorage.clear();
  }

  /**
   * Validates existing storage data against schemas
   * @private
   */
  private validateExistingStorage(): void {
    for (const [key, schema] of this.schemas.entries()) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          schema.parse(parsed);
        } catch (error) {
          console.warn(`Invalid data found in storage for key: ${key}`);
          this.removeItem(key);
        }
      }
    }
  }

  /**
   * Handles storage events for cross-tab synchronization
   * @private
   */
  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.storageArea !== localStorage) return;
    
    // Validate changed data if schema exists
    if (event.key && this.schemas.has(event.key) && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        const schema = this.schemas.get(event.key)!;
        schema.parse(parsed);
      } catch (error) {
        console.warn(`Invalid data detected in storage event for key: ${event.key}`);
      }
    }
  };
}

// Export singleton instance
export const storageService = new StorageService();
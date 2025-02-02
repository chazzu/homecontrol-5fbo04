import { nanoid } from 'nanoid'; // v4.0.0
import { z } from 'zod'; // v3.21.4
import { compress, decompress } from 'lz-string'; // v1.5.0

import { FloorPlan, FloorPlanUploadData, FloorPlanError } from '../types/floorPlan.types';
import { ApiService } from './api';
import { StorageService } from './storage';
import { STORAGE_KEYS, STORAGE_LIMITS, ERROR_CODES, PERFORMANCE_THRESHOLDS } from '../config/constants';

/**
 * Schema for validating floor plan data
 */
const floorPlanSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  svgData: z.string(),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    aspectRatio: z.number().positive()
  }),
  scale: z.number().positive(),
  order: z.number().int(),
  entityPlacements: z.map(
    z.string(),
    z.object({
      x: z.number(),
      y: z.number(),
      scale: z.number().positive(),
      rotation: z.number()
    })
  ),
  metadata: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
    createdBy: z.string(),
    customData: z.record(z.unknown())
  })
});

/**
 * Service class for managing floor plans with comprehensive validation,
 * caching, and performance monitoring
 */
export class FloorPlanService {
  private floorPlans: Map<string, FloorPlan> = new Map();
  private lastAccessed: Map<string, number> = new Map();
  private readonly cacheTimeout = 300000; // 5 minutes
  private readonly maxCacheSize = 50;
  private readonly compressionThreshold = 1048576; // 1MB

  constructor(
    private apiService: ApiService,
    private storageService: StorageService
  ) {
    this.initializeCache();
    this.setupPerformanceMonitoring();
  }

  /**
   * Retrieves all floor plans with caching and validation
   */
  public async getFloorPlans(): Promise<Map<string, FloorPlan>> {
    try {
      const startTime = performance.now();
      
      // Return cached data if valid
      if (this.isCacheValid()) {
        return this.floorPlans;
      }

      // Load from storage
      const storedData = this.storageService.getItem<FloorPlan[]>(STORAGE_KEYS.floorPlans);
      if (storedData) {
        this.floorPlans = new Map(storedData.map(plan => [plan.id, plan]));
        this.updateCacheTimestamps();
      }

      const duration = performance.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLDS.maxRestoreTime) {
        console.warn(`Floor plan retrieval took ${duration}ms`);
      }

      return this.floorPlans;
    } catch (error) {
      throw this.handleError('Failed to retrieve floor plans', error);
    }
  }

  /**
   * Creates a new floor plan with validation and storage
   */
  public async createFloorPlan(data: FloorPlanUploadData): Promise<FloorPlan> {
    try {
      const startTime = performance.now();

      // Validate SVG data
      if (!this.isValidSVG(data.svgData)) {
        throw new Error('Invalid SVG data');
      }

      // Create floor plan object
      const floorPlan: FloorPlan = {
        id: nanoid(),
        name: data.name,
        svgData: this.compressDataIfNeeded(data.svgData),
        dimensions: this.calculateDimensions(data.svgData),
        scale: data.scale,
        order: await this.getNextOrder(),
        entityPlacements: new Map(),
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'user', // Should be replaced with actual user ID
          customData: data.metadata || {}
        }
      };

      // Validate with schema
      floorPlanSchema.parse(floorPlan);

      // Update cache and storage
      this.floorPlans.set(floorPlan.id, floorPlan);
      this.lastAccessed.set(floorPlan.id, Date.now());
      await this.persistFloorPlans();

      const duration = performance.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLDS.maxResponseTime) {
        console.warn(`Floor plan creation took ${duration}ms`);
      }

      return floorPlan;
    } catch (error) {
      throw this.handleError('Failed to create floor plan', error);
    }
  }

  /**
   * Updates an existing floor plan with validation
   */
  public async updateFloorPlan(id: string, updates: Partial<FloorPlan>): Promise<FloorPlan> {
    try {
      const floorPlan = this.floorPlans.get(id);
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }

      const updatedPlan: FloorPlan = {
        ...floorPlan,
        ...updates,
        metadata: {
          ...floorPlan.metadata,
          updatedAt: new Date().toISOString()
        }
      };

      // Validate updated plan
      floorPlanSchema.parse(updatedPlan);

      // Update cache and storage
      this.floorPlans.set(id, updatedPlan);
      this.lastAccessed.set(id, Date.now());
      await this.persistFloorPlans();

      return updatedPlan;
    } catch (error) {
      throw this.handleError('Failed to update floor plan', error);
    }
  }

  /**
   * Deletes a floor plan and updates storage
   */
  public async deleteFloorPlan(id: string): Promise<void> {
    try {
      if (!this.floorPlans.has(id)) {
        throw new Error('Floor plan not found');
      }

      this.floorPlans.delete(id);
      this.lastAccessed.delete(id);
      await this.persistFloorPlans();
    } catch (error) {
      throw this.handleError('Failed to delete floor plan', error);
    }
  }

  /**
   * Updates entity placement on a floor plan
   */
  public async updateEntityPlacement(
    floorPlanId: string,
    entityId: string,
    position: { x: number; y: number; scale?: number; rotation?: number }
  ): Promise<void> {
    try {
      const floorPlan = this.floorPlans.get(floorPlanId);
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }

      floorPlan.entityPlacements.set(entityId, {
        x: position.x,
        y: position.y,
        scale: position.scale || 1,
        rotation: position.rotation || 0
      });

      await this.persistFloorPlans();
    } catch (error) {
      throw this.handleError('Failed to update entity placement', error);
    }
  }

  /**
   * Removes an entity from a floor plan
   */
  public async removeEntity(floorPlanId: string, entityId: string): Promise<void> {
    try {
      const floorPlan = this.floorPlans.get(floorPlanId);
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }

      floorPlan.entityPlacements.delete(entityId);
      await this.persistFloorPlans();
    } catch (error) {
      throw this.handleError('Failed to remove entity', error);
    }
  }

  /**
   * Validates and processes SVG data
   */
  private isValidSVG(svgData: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgData, 'image/svg+xml');
      return !doc.querySelector('parsererror');
    } catch {
      return false;
    }
  }

  /**
   * Calculates dimensions from SVG data
   */
  private calculateDimensions(svgData: string): { width: number; height: number; aspectRatio: number } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgData, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (!svg) {
      throw new Error('Invalid SVG structure');
    }

    const width = parseFloat(svg.getAttribute('width') || '0');
    const height = parseFloat(svg.getAttribute('height') || '0');
    
    if (!width || !height) {
      throw new Error('Invalid SVG dimensions');
    }

    return {
      width,
      height,
      aspectRatio: width / height
    };
  }

  /**
   * Compresses data if it exceeds threshold
   */
  private compressDataIfNeeded(data: string): string {
    if (data.length > this.compressionThreshold) {
      return compress(data);
    }
    return data;
  }

  /**
   * Decompresses data if compressed
   */
  private decompressIfNeeded(data: string): string {
    try {
      const decompressed = decompress(data);
      return decompressed || data;
    } catch {
      return data;
    }
  }

  /**
   * Persists floor plans to storage
   */
  private async persistFloorPlans(): Promise<void> {
    try {
      const floorPlansArray = Array.from(this.floorPlans.values());
      this.storageService.setItem(STORAGE_KEYS.floorPlans, floorPlansArray);
    } catch (error) {
      throw this.handleError('Failed to persist floor plans', error);
    }
  }

  /**
   * Initializes the cache from storage
   */
  private async initializeCache(): Promise<void> {
    try {
      const storedData = this.storageService.getItem<FloorPlan[]>(STORAGE_KEYS.floorPlans);
      if (storedData) {
        this.floorPlans = new Map(storedData.map(plan => [plan.id, plan]));
        this.updateCacheTimestamps();
      }
    } catch (error) {
      console.error('Failed to initialize cache:', error);
    }
  }

  /**
   * Updates cache timestamps
   */
  private updateCacheTimestamps(): void {
    const now = Date.now();
    this.floorPlans.forEach((_, id) => {
      this.lastAccessed.set(id, now);
    });
  }

  /**
   * Checks if cache is valid
   */
  private isCacheValid(): boolean {
    if (this.floorPlans.size === 0) return false;
    
    const now = Date.now();
    return Array.from(this.lastAccessed.values()).every(
      timestamp => now - timestamp < this.cacheTimeout
    );
  }

  /**
   * Gets the next available order number
   */
  private async getNextOrder(): Promise<number> {
    const orders = Array.from(this.floorPlans.values()).map(plan => plan.order);
    return orders.length > 0 ? Math.max(...orders) + 1 : 0;
  }

  /**
   * Sets up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > PERFORMANCE_THRESHOLDS.maxResponseTime) {
            console.warn(`Long task detected in FloorPlanService: ${entry.duration}ms`);
          }
        });
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  /**
   * Handles and formats errors
   */
  private handleError(message: string, error: unknown): FloorPlanError {
    if (error instanceof Error) {
      return {
        code: ERROR_CODES.STORAGE.INVALID_DATA,
        message: `${message}: ${error.message}`,
        details: { originalError: error }
      };
    }
    return {
      code: ERROR_CODES.STORAGE.INVALID_DATA,
      message,
      details: { originalError: error }
    };
  }
}

// Export singleton instance
export const floorPlanService = new FloorPlanService(
  new ApiService(),
  new StorageService()
);
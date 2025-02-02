import { z } from 'zod'; // v3.0+
import { IFloorPlan, EntityPlacement } from '../interfaces/IFloorPlan';
import { validateFloorPlan } from './validation';
import { processSvgFloorPlan } from './svgProcessor';

// Constants for floor plan processing and validation
const MAX_ENTITIES_PER_PLAN = 100;
const MIN_SCALE_VALUE = 0.1;
const MAX_SCALE_VALUE = 10.0;
const CACHE_EXPIRY_TIME = 3600000; // 1 hour in milliseconds

// Cache for processed floor plans
interface CacheEntry {
    data: IFloorPlan;
    timestamp: number;
}

const processedFloorPlanCache = new Map<string, CacheEntry>();

/**
 * Processes a new floor plan with enhanced security measures, validates its structure,
 * optimizes SVG content, and prepares it for storage with caching support
 * @param floorPlan - Floor plan data to process
 * @returns Promise<IFloorPlan> - Processed, validated, and cached floor plan
 */
export async function processFloorPlan(floorPlan: IFloorPlan): Promise<IFloorPlan> {
    try {
        // Validate floor plan structure
        const validationResult = await validateFloorPlan(floorPlan);
        if (!validationResult.isValid) {
            throw new Error(`Floor plan validation failed: ${validationResult.errors.join(', ')}`);
        }

        // Process SVG content
        const { svgData, dimensions, hash } = await processSvgFloorPlan(floorPlan.svgData);

        // Check cache for existing processed plan
        const cacheKey = `${floorPlan.id}-${hash}`;
        const cachedPlan = processedFloorPlanCache.get(cacheKey);
        if (cachedPlan && (Date.now() - cachedPlan.timestamp) < CACHE_EXPIRY_TIME) {
            return cachedPlan.data;
        }

        // Update floor plan with processed data
        const processedPlan: IFloorPlan = {
            ...floorPlan,
            svgData,
            dimensions,
            entityPlacements: floorPlan.entityPlacements || [],
            updatedAt: new Date()
        };

        // Validate entity placements
        if (!await validateEntityPlacements(processedPlan.entityPlacements, dimensions)) {
            throw new Error('Invalid entity placements detected');
        }

        // Cache processed plan
        processedFloorPlanCache.set(cacheKey, {
            data: processedPlan,
            timestamp: Date.now()
        });

        return processedPlan;
    } catch (error) {
        throw new Error(`Floor plan processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Validates entity placements within a floor plan with enhanced security checks
 * @param placements - Array of entity placements to validate
 * @param dimensions - Floor plan dimensions
 * @returns Promise<boolean> - True if all placements are valid
 */
export async function validateEntityPlacements(
    placements: Array<EntityPlacement>,
    dimensions: { width: number; height: number }
): Promise<boolean> {
    try {
        // Check number of entities
        if (placements.length > MAX_ENTITIES_PER_PLAN) {
            throw new Error(`Number of entities exceeds maximum limit of ${MAX_ENTITIES_PER_PLAN}`);
        }

        // Create a Set for tracking unique entity IDs
        const entityIds = new Set<string>();

        // Validate each placement
        for (const placement of placements) {
            // Check for duplicate entity IDs
            if (entityIds.has(placement.entityId)) {
                throw new Error(`Duplicate entity ID detected: ${placement.entityId}`);
            }
            entityIds.add(placement.entityId);

            // Validate coordinates
            if (placement.x < 0 || placement.x > dimensions.width ||
                placement.y < 0 || placement.y > dimensions.height) {
                throw new Error(`Entity ${placement.entityId} placement coordinates out of bounds`);
            }

            // Validate scale
            if (placement.scale < MIN_SCALE_VALUE || placement.scale > MAX_SCALE_VALUE) {
                throw new Error(`Entity ${placement.entityId} scale out of allowed range`);
            }
        }

        return true;
    } catch (error) {
        throw new Error(`Entity placement validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Updates the placement of an entity within a floor plan with optimized batch processing
 * @param floorPlan - Floor plan to update
 * @param entityId - ID of the entity to update
 * @param newPlacement - New placement data for the entity
 * @returns Promise<IFloorPlan> - Updated floor plan
 */
export async function updateEntityPlacement(
    floorPlan: IFloorPlan,
    entityId: string,
    newPlacement: EntityPlacement
): Promise<IFloorPlan> {
    try {
        // Validate new placement
        if (!await validateEntityPlacements([newPlacement], floorPlan.dimensions)) {
            throw new Error('Invalid entity placement');
        }

        // Create updated floor plan
        const updatedPlan: IFloorPlan = {
            ...floorPlan,
            entityPlacements: floorPlan.entityPlacements.map(placement =>
                placement.entityId === entityId ? newPlacement : placement
            ),
            updatedAt: new Date()
        };

        // Process and validate updated floor plan
        return await processFloorPlan(updatedPlan);
    } catch (error) {
        throw new Error(`Entity placement update error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Removes an entity placement from a floor plan with cache management
 * @param floorPlan - Floor plan to update
 * @param entityId - ID of the entity to remove
 * @returns Promise<IFloorPlan> - Updated floor plan
 */
export async function removeEntityPlacement(
    floorPlan: IFloorPlan,
    entityId: string
): Promise<IFloorPlan> {
    try {
        // Create updated floor plan
        const updatedPlan: IFloorPlan = {
            ...floorPlan,
            entityPlacements: floorPlan.entityPlacements.filter(
                placement => placement.entityId !== entityId
            ),
            updatedAt: new Date()
        };

        // Process and validate updated floor plan
        return await processFloorPlan(updatedPlan);
    } catch (error) {
        throw new Error(`Entity removal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
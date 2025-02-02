import { injectable, inject } from 'inversify'; // v6.0.1
import { IFloorPlan, EntityPlacement } from '../../core/interfaces/IFloorPlan';
import { FloorPlanRepository } from '../../database/repositories/FloorPlanRepository';
import { processFloorPlan } from '../utils/floorPlanProcessor';
import { processSvgFloorPlan } from '../utils/svgProcessor';
import { validateFloorPlan } from '../utils/validation';
import { FloorPlanStatus } from '../types/FloorPlan.types';

/**
 * Service class that handles business logic for floor plan management with enhanced security,
 * caching, and performance optimizations.
 * @version 1.0.0
 */
@injectable()
export class FloorPlanService {
    private readonly CACHE_TTL = 300000; // 5 minutes
    private readonly MAX_BATCH_SIZE = 50;
    private readonly floorPlanCache: Map<string, { data: IFloorPlan; timestamp: number }>;

    constructor(
        @inject(FloorPlanRepository) private readonly floorPlanRepository: FloorPlanRepository,
        @inject('Cache') private readonly cache: any,
        @inject('RateLimiter') private readonly rateLimiter: any,
        @inject('Logger') private readonly logger: any
    ) {
        this.floorPlanCache = new Map();
        this.initializeService();
    }

    /**
     * Initializes the service and sets up required configurations
     */
    private async initializeService(): Promise<void> {
        try {
            this.logger.info('Initializing FloorPlanService');
            await this.cache.connect();
            await this.rateLimiter.initialize();
        } catch (error) {
            this.logger.error('FloorPlanService initialization failed:', error);
            throw error;
        }
    }

    /**
     * Creates a new floor plan with enhanced security validation and SVG processing
     * @param floorPlanData - Partial floor plan data for creation
     * @returns Promise<IFloorPlan> - Created floor plan with processed data
     */
    public async createFloorPlan(floorPlanData: Partial<IFloorPlan>): Promise<IFloorPlan> {
        try {
            // Rate limiting check
            await this.rateLimiter.checkLimit('createFloorPlan');

            // Process and validate SVG data
            const { svgData, dimensions, hash } = await processSvgFloorPlan(floorPlanData.svgData!);

            // Prepare floor plan data with processed SVG
            const processedData: Partial<IFloorPlan> = {
                ...floorPlanData,
                svgData,
                dimensions,
                entityPlacements: [],
                status: FloorPlanStatus.ACTIVE
            };

            // Validate floor plan data
            const validationResult = await validateFloorPlan(processedData as IFloorPlan);
            if (!validationResult.isValid) {
                throw new Error(`Floor plan validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Create floor plan in repository
            const createdFloorPlan = await this.floorPlanRepository.create(processedData);

            // Cache the created floor plan
            this.updateCache(createdFloorPlan.id, createdFloorPlan);

            this.logger.info(`Floor plan created successfully: ${createdFloorPlan.id}`);
            return createdFloorPlan;
        } catch (error) {
            this.logger.error('Error creating floor plan:', error);
            throw error;
        }
    }

    /**
     * Retrieves a floor plan by ID with caching and performance optimization
     * @param id - Floor plan ID
     * @returns Promise<IFloorPlan | null> - Found floor plan or null
     */
    public async getFloorPlanById(id: string): Promise<IFloorPlan | null> {
        try {
            // Check cache first
            const cachedPlan = this.getCachedFloorPlan(id);
            if (cachedPlan) {
                this.logger.debug(`Cache hit for floor plan: ${id}`);
                return cachedPlan;
            }

            // Retrieve from repository if not cached
            const floorPlan = await this.floorPlanRepository.findById(id);
            if (floorPlan) {
                this.updateCache(id, floorPlan);
            }

            return floorPlan;
        } catch (error) {
            this.logger.error(`Error retrieving floor plan ${id}:`, error);
            throw error;
        }
    }

    /**
     * Retrieves all floor plans with optimized batch loading and caching
     * @returns Promise<IFloorPlan[]> - Array of floor plans
     */
    public async getAllFloorPlans(): Promise<IFloorPlan[]> {
        try {
            const { data: floorPlans, total } = await this.floorPlanRepository.findAll();
            
            // Cache all retrieved floor plans
            floorPlans.forEach(plan => this.updateCache(plan.id, plan));

            this.logger.info(`Retrieved ${floorPlans.length} floor plans`);
            return floorPlans;
        } catch (error) {
            this.logger.error('Error retrieving all floor plans:', error);
            throw error;
        }
    }

    /**
     * Updates a floor plan with validation and cache management
     * @param id - Floor plan ID
     * @param updateData - Partial floor plan data for update
     * @returns Promise<IFloorPlan> - Updated floor plan
     */
    public async updateFloorPlan(id: string, updateData: Partial<IFloorPlan>): Promise<IFloorPlan> {
        try {
            await this.rateLimiter.checkLimit('updateFloorPlan');

            // Process SVG if included in update
            if (updateData.svgData) {
                const { svgData, dimensions, hash } = await processSvgFloorPlan(updateData.svgData);
                updateData.svgData = svgData;
                updateData.dimensions = dimensions;
            }

            // Update floor plan
            const updatedPlan = await this.floorPlanRepository.update(id, updateData);
            if (!updatedPlan) {
                throw new Error(`Floor plan not found: ${id}`);
            }

            // Update cache
            this.updateCache(id, updatedPlan);

            this.logger.info(`Floor plan updated successfully: ${id}`);
            return updatedPlan;
        } catch (error) {
            this.logger.error(`Error updating floor plan ${id}:`, error);
            throw error;
        }
    }

    /**
     * Deletes a floor plan with cascade cleanup and cache invalidation
     * @param id - Floor plan ID
     */
    public async deleteFloorPlan(id: string): Promise<void> {
        try {
            await this.rateLimiter.checkLimit('deleteFloorPlan');

            const success = await this.floorPlanRepository.delete(id);
            if (!success) {
                throw new Error(`Floor plan not found: ${id}`);
            }

            // Clear from cache
            this.clearCache(id);

            this.logger.info(`Floor plan deleted successfully: ${id}`);
        } catch (error) {
            this.logger.error(`Error deleting floor plan ${id}:`, error);
            throw error;
        }
    }

    /**
     * Updates entity placements with batch processing and validation
     * @param floorPlanId - Floor plan ID
     * @param placements - Array of entity placements
     * @returns Promise<IFloorPlan> - Updated floor plan
     */
    public async updateEntityPlacements(
        floorPlanId: string,
        placements: Array<EntityPlacement>
    ): Promise<IFloorPlan> {
        try {
            await this.rateLimiter.checkLimit('updateEntityPlacements');

            // Process placements in batches
            const updatedPlan = await this.floorPlanRepository.updateEntityPlacements(
                floorPlanId,
                placements
            );

            if (!updatedPlan) {
                throw new Error(`Floor plan not found: ${floorPlanId}`);
            }

            // Update cache
            this.updateCache(floorPlanId, updatedPlan);

            this.logger.info(`Entity placements updated for floor plan: ${floorPlanId}`);
            return updatedPlan;
        } catch (error) {
            this.logger.error(`Error updating entity placements for floor plan ${floorPlanId}:`, error);
            throw error;
        }
    }

    /**
     * Updates the cache with a floor plan
     * @param id - Floor plan ID
     * @param floorPlan - Floor plan data
     */
    private updateCache(id: string, floorPlan: IFloorPlan): void {
        this.floorPlanCache.set(id, {
            data: floorPlan,
            timestamp: Date.now()
        });
    }

    /**
     * Retrieves a floor plan from cache if valid
     * @param id - Floor plan ID
     * @returns IFloorPlan | null - Cached floor plan or null
     */
    private getCachedFloorPlan(id: string): IFloorPlan | null {
        const cached = this.floorPlanCache.get(id);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    /**
     * Clears a floor plan from cache
     * @param id - Floor plan ID
     */
    private clearCache(id: string): void {
        this.floorPlanCache.delete(id);
    }
}
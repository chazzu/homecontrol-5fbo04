import { injectable, inject } from 'inversify'; // v6.0.1
import { EventEmitter } from 'events'; // v3.3.0
import { IFloorPlan, EntityPlacement } from './interfaces/IFloorPlan';
import { FloorPlanService } from './services/FloorPlanService';
import { processSvgFloorPlan } from './utils/svgProcessor';

/**
 * Core manager class that orchestrates floor plan operations and state management
 * in the Smart Home Dashboard system. Provides real-time updates and caching.
 * @version 1.0.0
 */
@injectable()
export class FloorPlanManager {
    private readonly eventEmitter: EventEmitter;
    private readonly floorPlanCache: Map<string, { data: IFloorPlan; timestamp: number }>;
    private readonly CACHE_TTL = 300000; // 5 minutes in milliseconds

    constructor(
        @inject(FloorPlanService) private readonly floorPlanService: FloorPlanService
    ) {
        this.eventEmitter = new EventEmitter();
        this.floorPlanCache = new Map();
        this.eventEmitter.setMaxListeners(100); // Support multiple subscribers
    }

    /**
     * Creates a new floor plan with processed SVG data and emits creation event
     * @param floorPlanData - Partial floor plan data for creation
     * @returns Promise<IFloorPlan> - Created floor plan
     */
    public async createFloorPlan(floorPlanData: Partial<IFloorPlan>): Promise<IFloorPlan> {
        try {
            // Process SVG data
            if (floorPlanData.svgData) {
                const { svgData, dimensions } = await processSvgFloorPlan(floorPlanData.svgData);
                floorPlanData.svgData = svgData;
                floorPlanData.dimensions = dimensions;
            }

            // Create floor plan
            const createdPlan = await this.floorPlanService.createFloorPlan(floorPlanData);

            // Update cache
            this.updateCache(createdPlan.id, createdPlan);

            // Emit creation event
            this.eventEmitter.emit('floorPlan:created', createdPlan);

            return createdPlan;
        } catch (error) {
            throw new Error(`Failed to create floor plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Retrieves a floor plan by ID, using cache when available
     * @param id - Floor plan ID
     * @returns Promise<IFloorPlan | null> - Found floor plan or null
     */
    public async getFloorPlan(id: string): Promise<IFloorPlan | null> {
        try {
            // Check cache first
            const cachedPlan = this.getCachedFloorPlan(id);
            if (cachedPlan) {
                return cachedPlan;
            }

            // Fetch from service if not in cache
            const floorPlan = await this.floorPlanService.getFloorPlanById(id);
            
            if (floorPlan) {
                this.updateCache(id, floorPlan);
            }

            return floorPlan;
        } catch (error) {
            throw new Error(`Failed to get floor plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Retrieves all floor plans with caching
     * @returns Promise<IFloorPlan[]> - Array of floor plans
     */
    public async getAllFloorPlans(): Promise<IFloorPlan[]> {
        try {
            const floorPlans = await this.floorPlanService.getAllFloorPlans();
            
            // Update cache for all plans
            floorPlans.forEach(plan => this.updateCache(plan.id, plan));

            // Sort by order property
            return floorPlans.sort((a, b) => a.order - b.order);
        } catch (error) {
            throw new Error(`Failed to get all floor plans: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Updates a floor plan and handles real-time updates
     * @param id - Floor plan ID
     * @param updateData - Partial floor plan data for update
     * @returns Promise<IFloorPlan> - Updated floor plan
     */
    public async updateFloorPlan(id: string, updateData: Partial<IFloorPlan>): Promise<IFloorPlan> {
        try {
            // Process SVG if included in update
            if (updateData.svgData) {
                const { svgData, dimensions } = await processSvgFloorPlan(updateData.svgData);
                updateData.svgData = svgData;
                updateData.dimensions = dimensions;
            }

            // Update floor plan
            const updatedPlan = await this.floorPlanService.updateFloorPlan(id, updateData);

            // Update cache
            this.updateCache(id, updatedPlan);

            // Emit update event
            this.eventEmitter.emit('floorPlan:updated', updatedPlan);

            return updatedPlan;
        } catch (error) {
            throw new Error(`Failed to update floor plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Deletes a floor plan and handles cleanup
     * @param id - Floor plan ID
     */
    public async deleteFloorPlan(id: string): Promise<void> {
        try {
            await this.floorPlanService.deleteFloorPlan(id);
            
            // Clear from cache
            this.floorPlanCache.delete(id);

            // Emit deletion event
            this.eventEmitter.emit('floorPlan:deleted', id);
        } catch (error) {
            throw new Error(`Failed to delete floor plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Updates entity placements within a floor plan
     * @param floorPlanId - Floor plan ID
     * @param placements - Array of entity placements
     * @returns Promise<IFloorPlan> - Updated floor plan
     */
    public async updateEntityPlacements(
        floorPlanId: string,
        placements: Array<EntityPlacement>
    ): Promise<IFloorPlan> {
        try {
            const updatedPlan = await this.floorPlanService.updateEntityPlacements(
                floorPlanId,
                placements
            );

            // Update cache
            this.updateCache(floorPlanId, updatedPlan);

            // Emit entity placement update event
            this.eventEmitter.emit('floorPlan:entityPlacementsUpdated', {
                floorPlanId,
                placements
            });

            return updatedPlan;
        } catch (error) {
            throw new Error(`Failed to update entity placements: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Subscribes to floor plan update events
     * @param callback - Event handler function
     * @returns Function to unsubscribe from events
     */
    public subscribeToUpdates(callback: (event: string, data: any) => void): () => void {
        const events = [
            'floorPlan:created',
            'floorPlan:updated',
            'floorPlan:deleted',
            'floorPlan:entityPlacementsUpdated'
        ];

        // Register listeners for all events
        events.forEach(event => {
            this.eventEmitter.on(event, (data) => callback(event, data));
        });

        // Return unsubscribe function
        return () => {
            events.forEach(event => {
                this.eventEmitter.removeListener(event, callback);
            });
        };
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
}
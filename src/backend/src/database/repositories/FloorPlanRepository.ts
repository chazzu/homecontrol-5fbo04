/**
 * Repository class for handling floor plan data persistence and database operations.
 * Implements caching, validation, and optimized query performance for floor plan management.
 * @version 1.0.0
 */

import { Model } from 'mongoose'; // mongoose ^7.0.0
import { FloorPlan } from '../models/FloorPlan';
import { IFloorPlan } from '../../core/interfaces/IFloorPlan';
import { FloorPlanStatus } from '../../core/types/FloorPlan.types';

/**
 * Cache configuration type for floor plan data
 */
type CacheConfig = {
    ttl: number;
    maxSize: number;
};

/**
 * Repository class for handling floor plan database operations
 */
export class FloorPlanRepository {
    private readonly model: Model<IFloorPlan>;
    private readonly cache: Map<string, { data: IFloorPlan; timestamp: number }>;
    private readonly cacheConfig: CacheConfig = {
        ttl: 300000, // 5 minutes
        maxSize: 100 // Maximum cache entries
    };

    constructor() {
        this.model = FloorPlan;
        this.cache = new Map();
        this.initializeIndexes();
    }

    /**
     * Initialize database indexes for optimized queries
     */
    private async initializeIndexes(): Promise<void> {
        await this.model.collection.createIndex({ name: 1 }, { unique: true });
        await this.model.collection.createIndex({ status: 1 });
        await this.model.collection.createIndex({ order: 1 });
    }

    /**
     * Manages cache operations for floor plan data
     */
    private manageCache(id: string, data?: IFloorPlan): void {
        if (data) {
            // Clear oldest entry if cache is full
            if (this.cache.size >= this.cacheConfig.maxSize) {
                const oldestKey = this.cache.keys().next().value;
                this.cache.delete(oldestKey);
            }
            this.cache.set(id, { data, timestamp: Date.now() });
        } else {
            this.cache.delete(id);
        }
    }

    /**
     * Creates a new floor plan with validation
     */
    async create(floorPlanData: Partial<IFloorPlan>): Promise<IFloorPlan> {
        const session = await this.model.startSession();
        try {
            session.startTransaction();

            // Check for duplicate names
            const existingPlan = await this.model.findOne({ 
                name: floorPlanData.name,
                status: { $ne: FloorPlanStatus.DELETED }
            });
            if (existingPlan) {
                throw new Error(`Floor plan with name "${floorPlanData.name}" already exists`);
            }

            // Create and save new floor plan
            const floorPlan = new this.model({
                ...floorPlanData,
                status: floorPlanData.status || FloorPlanStatus.ACTIVE
            });
            await floorPlan.save({ session });

            await session.commitTransaction();
            this.manageCache(floorPlan.id, floorPlan);
            return floorPlan;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Retrieves a floor plan by ID with caching
     */
    async findById(id: string): Promise<IFloorPlan | null> {
        // Check cache first
        const cached = this.cache.get(id);
        if (cached && Date.now() - cached.timestamp < this.cacheConfig.ttl) {
            return cached.data;
        }

        // Query database if not in cache
        const floorPlan = await this.model.findOne({
            _id: id,
            status: { $ne: FloorPlanStatus.DELETED }
        });

        if (floorPlan) {
            this.manageCache(id, floorPlan);
        }
        return floorPlan;
    }

    /**
     * Retrieves all active floor plans with pagination
     */
    async findAll(page: number = 1, limit: number = 10): Promise<{ data: IFloorPlan[]; total: number }> {
        const skip = (page - 1) * limit;
        const query = { status: FloorPlanStatus.ACTIVE };

        const [floorPlans, total] = await Promise.all([
            this.model.find(query)
                .sort({ order: 1 })
                .skip(skip)
                .limit(limit),
            this.model.countDocuments(query)
        ]);

        return { data: floorPlans, total };
    }

    /**
     * Updates a floor plan by ID within transaction
     */
    async update(id: string, updateData: Partial<IFloorPlan>): Promise<IFloorPlan | null> {
        const session = await this.model.startSession();
        try {
            session.startTransaction();

            // Check for name conflicts if name is being updated
            if (updateData.name) {
                const existingPlan = await this.model.findOne({
                    _id: { $ne: id },
                    name: updateData.name,
                    status: { $ne: FloorPlanStatus.DELETED }
                });
                if (existingPlan) {
                    throw new Error(`Floor plan with name "${updateData.name}" already exists`);
                }
            }

            const updatedPlan = await this.model.findOneAndUpdate(
                { _id: id, status: { $ne: FloorPlanStatus.DELETED } },
                { $set: updateData },
                { new: true, session, runValidators: true }
            );

            await session.commitTransaction();
            if (updatedPlan) {
                this.manageCache(id, updatedPlan);
            }
            return updatedPlan;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Soft deletes a floor plan by ID
     */
    async delete(id: string): Promise<boolean> {
        const result = await this.model.findOneAndUpdate(
            { _id: id, status: { $ne: FloorPlanStatus.DELETED } },
            { $set: { status: FloorPlanStatus.DELETED } }
        );

        if (result) {
            this.manageCache(id);
            return true;
        }
        return false;
    }

    /**
     * Updates entity placements for a floor plan with validation
     */
    async updateEntityPlacements(
        id: string,
        entityPlacements: IFloorPlan['entityPlacements']
    ): Promise<IFloorPlan | null> {
        const session = await this.model.startSession();
        try {
            session.startTransaction();

            const floorPlan = await this.model.findOne({
                _id: id,
                status: { $ne: FloorPlanStatus.DELETED }
            });

            if (!floorPlan) {
                return null;
            }

            // Validate entity placements are within dimensions
            const invalidPlacements = entityPlacements.filter(placement => 
                placement.x > floorPlan.dimensions.width ||
                placement.y > floorPlan.dimensions.height
            );

            if (invalidPlacements.length > 0) {
                throw new Error('Entity placements must be within floor plan dimensions');
            }

            const updatedPlan = await this.model.findOneAndUpdate(
                { _id: id },
                { $set: { entityPlacements } },
                { new: true, session, runValidators: true }
            );

            await session.commitTransaction();
            if (updatedPlan) {
                this.manageCache(id, updatedPlan);
            }
            return updatedPlan;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}
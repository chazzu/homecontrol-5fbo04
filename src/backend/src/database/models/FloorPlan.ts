/**
 * MongoDB model for floor plan management in the Smart Home Dashboard system.
 * Implements comprehensive validation and lifecycle management for floor plans.
 * @version 1.0.0
 */

import { Schema, model, Document } from 'mongoose'; // mongoose ^7.0.0
import { IFloorPlan } from '../../core/interfaces/IFloorPlan';
import { FloorPlanStatus } from '../../core/types/FloorPlan.types';

/**
 * Interface for FloorPlan document with Mongoose specific fields
 */
interface IFloorPlanDocument extends IFloorPlan, Document {}

/**
 * Mongoose schema for entity placement within floor plans
 */
const EntityPlacementSchema = new Schema({
    entityId: {
        type: String,
        required: [true, 'Entity ID is required'],
        trim: true
    },
    x: {
        type: Number,
        required: [true, 'X coordinate is required'],
        validate: {
            validator: (value: number) => value >= 0,
            message: 'X coordinate must be non-negative'
        }
    },
    y: {
        type: Number,
        required: [true, 'Y coordinate is required'],
        validate: {
            validator: (value: number) => value >= 0,
            message: 'Y coordinate must be non-negative'
        }
    },
    scale: {
        type: Number,
        required: [true, 'Scale is required'],
        default: 1.0,
        validate: {
            validator: (value: number) => value > 0 && value <= 10,
            message: 'Scale must be between 0 and 10'
        }
    }
});

/**
 * Mongoose schema for floor plan dimensions
 */
const DimensionsSchema = new Schema({
    width: {
        type: Number,
        required: [true, 'Width is required'],
        validate: {
            validator: (value: number) => value > 0,
            message: 'Width must be positive'
        }
    },
    height: {
        type: Number,
        required: [true, 'Height is required'],
        validate: {
            validator: (value: number) => value > 0,
            message: 'Height must be positive'
        }
    }
}, { _id: false });

/**
 * Comprehensive Mongoose schema for floor plans with validation
 */
const FloorPlanSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Floor plan name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    svgData: {
        type: String,
        required: [true, 'SVG data is required'],
        validate: {
            validator: (value: string) => value.startsWith('<svg') && value.endsWith('</svg>'),
            message: 'Invalid SVG data format'
        }
    },
    dimensions: {
        type: DimensionsSchema,
        required: [true, 'Dimensions are required']
    },
    scale: {
        type: Number,
        required: [true, 'Scale is required'],
        default: 1.0,
        validate: {
            validator: (value: number) => value >= 0.1 && value <= 100,
            message: 'Scale must be between 0.1 and 100'
        }
    },
    order: {
        type: Number,
        required: [true, 'Display order is required'],
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: 'Order must be an integer'
        }
    },
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: Object.values(FloorPlanStatus),
        default: FloorPlanStatus.ACTIVE
    },
    entityPlacements: {
        type: [EntityPlacementSchema],
        default: [],
        validate: {
            validator: function(placements: any[]) {
                // Check for duplicate entity IDs
                const entityIds = placements.map(p => p.entityId);
                return entityIds.length === new Set(entityIds).size;
            },
            message: 'Duplicate entity placements are not allowed'
        }
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            return ret;
        }
    }
});

/**
 * Pre-save middleware for comprehensive validation
 */
FloorPlanSchema.pre('save', async function(next) {
    try {
        // Validate SVG data size
        if (this.svgData.length > 5000000) { // 5MB limit
            throw new Error('SVG data exceeds maximum size limit of 5MB');
        }

        // Validate entity placements are within dimensions
        const invalidPlacements = this.entityPlacements.filter(placement => {
            return placement.x > this.dimensions.width || 
                   placement.y > this.dimensions.height;
        });

        if (invalidPlacements.length > 0) {
            throw new Error('Entity placements must be within floor plan dimensions');
        }

        // Additional validation logic can be added here

        next();
    } catch (error) {
        next(error as Error);
    }
});

/**
 * Create and export the Mongoose model for floor plans
 */
export const FloorPlan = model<IFloorPlanDocument>('FloorPlan', FloorPlanSchema);
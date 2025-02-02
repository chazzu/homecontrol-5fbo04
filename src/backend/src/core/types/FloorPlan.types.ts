/**
 * Type definitions and enums for floor plan-related functionality in the Smart Home Dashboard system.
 * Provides comprehensive type safety for floor plan operations, entity placement, and validation.
 * @version 1.0.0
 */

import { IFloorPlan } from '../interfaces/IFloorPlan';

/**
 * Enum defining all possible states of a floor plan throughout its lifecycle.
 * Used for managing floor plan visibility and availability in the system.
 */
export enum FloorPlanStatus {
    /** Floor plan is active and visible to users */
    ACTIVE = 'ACTIVE',
    /** Floor plan is temporarily disabled but retained */
    INACTIVE = 'INACTIVE',
    /** Floor plan has been marked for deletion */
    DELETED = 'DELETED',
    /** Floor plan is in creation/editing phase */
    DRAFT = 'DRAFT',
    /** Floor plan is preserved but not actively used */
    ARCHIVED = 'ARCHIVED'
}

/**
 * Defines severity levels for validation errors
 */
export enum ErrorSeverity {
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    INFO = 'INFO'
}

/**
 * Supported measurement units for floor plan dimensions
 */
export enum MeasurementUnit {
    METERS = 'meters',
    FEET = 'feet',
    PIXELS = 'pixels'
}

/**
 * Comprehensive type for floor plan validation error handling with detailed error information.
 * Used to provide structured error feedback during floor plan operations.
 */
export type FloorPlanValidationError = {
    /** Unique error code for identification */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Specific field causing the validation error */
    field: string;
    /** Additional context and metadata about the error */
    details: Record<string, unknown>;
    /** Error severity level */
    severity: ErrorSeverity;
};

/**
 * Detailed type for floor plan dimensional properties with measurement units.
 * Extends the base Dimensions interface with additional scaling and unit information.
 */
export type FloorPlanDimensions = {
    /** Width in specified unit */
    width: number;
    /** Height in specified unit */
    height: number;
    /** Scale factor for rendering */
    scale: number;
    /** Measurement unit for dimensions */
    unit: MeasurementUnit;
    /** Width to height ratio */
    aspectRatio: number;
};

/**
 * Comprehensive type for entity placement coordinates with rotation and layer ordering.
 * Provides precise positioning control for entities on floor plans.
 */
export type EntityPlacementCoordinates = {
    /** Horizontal position from left edge */
    x: number;
    /** Vertical position from top edge */
    y: number;
    /** Individual scale factor for entity */
    scale: number;
    /** Rotation angle in degrees */
    rotation: number;
    /** Layer ordering for overlapping entities */
    zIndex: number;
};

/**
 * Type guard to check if an object is a valid FloorPlanDimensions
 */
export function isFloorPlanDimensions(obj: unknown): obj is FloorPlanDimensions {
    const dims = obj as FloorPlanDimensions;
    return (
        typeof dims === 'object' &&
        dims !== null &&
        typeof dims.width === 'number' &&
        typeof dims.height === 'number' &&
        typeof dims.scale === 'number' &&
        typeof dims.aspectRatio === 'number' &&
        Object.values(MeasurementUnit).includes(dims.unit)
    );
}

/**
 * Type guard to check if an object is a valid EntityPlacementCoordinates
 */
export function isEntityPlacementCoordinates(obj: unknown): obj is EntityPlacementCoordinates {
    const coords = obj as EntityPlacementCoordinates;
    return (
        typeof coords === 'object' &&
        coords !== null &&
        typeof coords.x === 'number' &&
        typeof coords.y === 'number' &&
        typeof coords.scale === 'number' &&
        typeof coords.rotation === 'number' &&
        typeof coords.zIndex === 'number'
    );
}
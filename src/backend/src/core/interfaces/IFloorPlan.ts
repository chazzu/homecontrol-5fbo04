/**
 * Core interfaces for floor plan management in the Smart Home Dashboard system.
 * These interfaces define the structure for floor plans, entity placements, and dimensions
 * to support the visual management of smart home devices.
 * @version 1.0.0
 */

/**
 * Defines dimensional properties for floor plan scaling and rendering.
 * Used to maintain proper aspect ratios and scaling of floor plan layouts.
 */
export interface Dimensions {
    /** Width of the floor plan in pixels */
    width: number;
    
    /** Height of the floor plan in pixels */
    height: number;
}

/**
 * Defines the precise positioning and scaling data for entity placement within floor plans.
 * Supports drag-and-drop functionality and maintains device positions.
 */
export interface EntityPlacement {
    /** Unique identifier of the smart home entity */
    entityId: string;
    
    /** X-coordinate position on the floor plan */
    x: number;
    
    /** Y-coordinate position on the floor plan */
    y: number;
    
    /** Individual scale factor for the entity icon */
    scale: number;
}

/**
 * Core interface defining the complete structure of a floor plan entity.
 * Provides comprehensive support for floor plan management including
 * SVG data, dimensions, entity placements, and metadata.
 */
export interface IFloorPlan {
    /** Unique identifier for the floor plan */
    id: string;
    
    /** Display name of the floor plan */
    name: string;
    
    /** SVG data representing the floor plan layout */
    svgData: string;
    
    /** Dimensional properties of the floor plan */
    dimensions: Dimensions;
    
    /** Global scale factor for the floor plan */
    scale: number;
    
    /** Display order in the floor plan list */
    order: number;
    
    /** Array of entity placements on this floor plan */
    entityPlacements: Array<EntityPlacement>;
    
    /** Timestamp of floor plan creation */
    createdAt: Date;
    
    /** Timestamp of last floor plan update */
    updatedAt: Date;
}
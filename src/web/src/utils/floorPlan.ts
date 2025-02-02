/**
 * @file Floor Plan Management Utilities
 * @version 1.0.0
 * 
 * Comprehensive utility functions for floor plan management, including SVG processing,
 * validation, coordinate transformations, and security measures.
 */

import { z } from 'zod'; // v3.0.0
import { FloorPlan } from '../types/floorPlan.types';
import { EntityPosition } from '../types/entity.types';

// Constants for SVG processing and validation
const MAX_SVG_SIZE = 5 * 1024 * 1024; // 5MB maximum SVG file size
const VALID_SVG_ELEMENTS = ['svg', 'g', 'path', 'rect', 'circle', 'line'] as const;
const SVG_SANITIZATION_OPTIONS = {
  allowedElements: VALID_SVG_ELEMENTS,
  allowedAttributes: ['viewBox', 'd', 'transform', 'fill', 'stroke'],
  stripComments: true,
  stripEmptyElements: true
} as const;

// Zod schema for floor plan validation
const floorPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  svgData: z.string().startsWith('data:image/svg+xml;base64,'),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    aspectRatio: z.number().positive()
  }),
  scale: z.number().positive(),
  order: z.number().int().min(0),
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
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    createdBy: z.string(),
    customData: z.record(z.unknown())
  })
});

/**
 * Interface for SVG processing options
 */
interface ProcessOptions {
  maxSize?: number;
  optimizePaths?: boolean;
  preserveAspectRatio?: boolean;
  sanitize?: boolean;
}

/**
 * Interface for SVG optimization statistics
 */
interface OptimizationStats {
  originalSize: number;
  processedSize: number;
  pathsOptimized: number;
  elementsRemoved: number;
}

/**
 * Processes, sanitizes, and optimizes SVG data for secure floor plan display
 * @param svgData - Base64 encoded SVG data
 * @param options - Processing options
 * @returns Processed SVG data with dimensions and optimization statistics
 * @throws Error if SVG processing fails or validation errors occur
 */
export async function processSVG(
  svgData: string,
  options: ProcessOptions = {}
): Promise<{
  svgData: string;
  dimensions: { width: number; height: number; aspectRatio: number };
  optimizationStats: OptimizationStats;
}> {
  // Validate input size
  const decodedSize = atob(svgData.split(',')[1]).length;
  if (decodedSize > (options.maxSize || MAX_SVG_SIZE)) {
    throw new Error('SVG_001: SVG file size exceeds maximum allowed size');
  }

  // Parse SVG document
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgData, 'image/svg+xml');
  if (doc.documentElement.tagName === 'parsererror') {
    throw new Error('SVG_001: Invalid SVG format');
  }

  // Security: Sanitize SVG content
  if (options.sanitize !== false) {
    sanitizeSVGContent(doc, SVG_SANITIZATION_OPTIONS);
  }

  // Extract and validate dimensions
  const svgElement = doc.documentElement;
  const viewBox = svgElement.getAttribute('viewBox')?.split(' ').map(Number);
  if (!viewBox || viewBox.length !== 4) {
    throw new Error('SVG_001: Invalid viewBox attribute');
  }

  const dimensions = {
    width: viewBox[2],
    height: viewBox[3],
    aspectRatio: viewBox[2] / viewBox[3]
  };

  // Optimize SVG paths if requested
  const stats: OptimizationStats = {
    originalSize: decodedSize,
    processedSize: 0,
    pathsOptimized: 0,
    elementsRemoved: 0
  };

  if (options.optimizePaths) {
    optimizeSVGPaths(doc, stats);
  }

  // Serialize processed SVG
  const serializer = new XMLSerializer();
  const processedSvg = serializer.serializeToString(doc);
  const processedData = `data:image/svg+xml;base64,${btoa(processedSvg)}`;

  stats.processedSize = atob(processedData.split(',')[1]).length;

  return { svgData: processedData, dimensions, optimizationStats: stats };
}

/**
 * Calculates precise entity position with scale factor support
 * @param position - Current entity position
 * @param floorPlanDimensions - Floor plan dimensions
 * @param scale - Scale factor (pixels per meter)
 * @returns Calculated entity position with boundary validation
 */
export function calculateEntityPosition(
  position: EntityPosition,
  floorPlanDimensions: { width: number; height: number },
  scale: number
): EntityPosition {
  // Validate input parameters
  if (!position || !floorPlanDimensions || scale <= 0) {
    throw new Error('ENT_001: Invalid position calculation parameters');
  }

  // Apply scale transformation
  const scaledPosition = {
    x: position.x * scale,
    y: position.y * scale,
    scale: position.scale,
    rotation: position.rotation
  };

  // Validate boundaries
  scaledPosition.x = Math.max(0, Math.min(scaledPosition.x, floorPlanDimensions.width));
  scaledPosition.y = Math.max(0, Math.min(scaledPosition.y, floorPlanDimensions.height));

  // Round to nearest pixel for crisp rendering
  return {
    x: Math.round(scaledPosition.x),
    y: Math.round(scaledPosition.y),
    scale: Number(scaledPosition.scale.toFixed(2)),
    rotation: Math.round(scaledPosition.rotation)
  };
}

/**
 * Validates floor plan data using zod schema
 * @param floorPlan - Floor plan data to validate
 * @returns Validation result with detailed error information
 */
export function validateFloorPlanData(
  floorPlan: FloorPlan
): { valid: boolean; errors?: string[] } {
  try {
    // Perform schema validation
    const result = floorPlanSchema.safeParse(floorPlan);

    if (!result.success) {
      return {
        valid: false,
        errors: result.error.errors.map(err => `CONF_001: ${err.message}`)
      };
    }

    // Additional validation checks
    const validationErrors: string[] = [];

    // Validate SVG data size
    const svgSize = atob(floorPlan.svgData.split(',')[1]).length;
    if (svgSize > MAX_SVG_SIZE) {
      validationErrors.push('SVG_001: SVG file size exceeds maximum allowed size');
    }

    // Validate entity placements
    floorPlan.entityPlacements.forEach((position, entityId) => {
      if (position.x < 0 || position.y < 0 ||
          position.x > floorPlan.dimensions.width ||
          position.y > floorPlan.dimensions.height) {
        validationErrors.push(`ENT_001: Invalid position for entity ${entityId}`);
      }
    });

    return {
      valid: validationErrors.length === 0,
      errors: validationErrors.length > 0 ? validationErrors : undefined
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`CONF_001: Validation failed - ${error.message}`]
    };
  }
}

/**
 * Sanitizes SVG content for security
 * @private
 */
function sanitizeSVGContent(
  doc: Document,
  options: typeof SVG_SANITIZATION_OPTIONS
): void {
  const removeUnsafeElements = (node: Element) => {
    Array.from(node.children).forEach(child => {
      if (!options.allowedElements.includes(child.tagName.toLowerCase() as any)) {
        node.removeChild(child);
      } else {
        // Remove unsafe attributes
        Array.from(child.attributes).forEach(attr => {
          if (!options.allowedAttributes.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
        });
        removeUnsafeElements(child);
      }
    });
  };

  removeUnsafeElements(doc.documentElement);
}

/**
 * Optimizes SVG paths for performance
 * @private
 */
function optimizeSVGPaths(doc: Document, stats: OptimizationStats): void {
  const paths = doc.getElementsByTagName('path');
  for (const path of Array.from(paths)) {
    const d = path.getAttribute('d');
    if (d) {
      // Simplify path data by reducing decimal precision
      const optimizedD = d.replace(/\d+\.\d+/g, match => 
        Number(match).toFixed(2)
      );
      path.setAttribute('d', optimizedD);
      stats.pathsOptimized++;
    }
  }
}
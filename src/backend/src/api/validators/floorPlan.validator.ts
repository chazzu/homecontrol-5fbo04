/**
 * Floor Plan Validator Module
 * Provides comprehensive validation schemas and helper functions for floor plan data
 * with enhanced security features and performance optimization.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.0+
import { IFloorPlan } from '../../core/interfaces/IFloorPlan';
import { FloorPlanValidationError } from '../../core/types/FloorPlan.types';
import { validateFloorPlan } from '../../core/utils/validation';

// Constants for validation rules and limits
const VALIDATION_LIMITS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  MIN_DIMENSION: 10,
  MAX_DIMENSION: 10000,
  MIN_SCALE: 0.1,
  MAX_SCALE: 10,
  MAX_SVG_SIZE: 5 * 1024 * 1024, // 5MB
  COORDINATE_PRECISION: 2
} as const;

// SVG security patterns
const SVG_SECURITY = {
  ALLOWED_TAGS: /^<svg( [^>]*)?>[^]*<\/svg>$/,
  DISALLOWED_PATTERNS: [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /on\w+=/i,
    /xlink:href/i
  ]
} as const;

/**
 * Enhanced schema for floor plan creation requests
 * Includes strict validation rules and security checks
 */
export const createFloorPlanSchema = z.object({
  name: z.string()
    .min(VALIDATION_LIMITS.NAME_MIN_LENGTH, 'Floor plan name is required')
    .max(VALIDATION_LIMITS.NAME_MAX_LENGTH, 'Floor plan name is too long')
    .trim()
    .regex(/^[\w\s-]+$/, 'Name can only contain letters, numbers, spaces, and hyphens'),

  svgData: z.string()
    .min(1, 'SVG data is required')
    .max(VALIDATION_LIMITS.MAX_SVG_SIZE, 'SVG file size exceeds maximum limit')
    .regex(SVG_SECURITY.ALLOWED_TAGS, 'Invalid SVG format')
    .refine(
      svg => !SVG_SECURITY.DISALLOWED_PATTERNS.some(pattern => pattern.test(svg)),
      'SVG contains potentially unsafe content'
    ),

  dimensions: z.object({
    width: z.number()
      .min(VALIDATION_LIMITS.MIN_DIMENSION, 'Width is too small')
      .max(VALIDATION_LIMITS.MAX_DIMENSION, 'Width exceeds maximum limit')
      .multipleOf(0.01),
    height: z.number()
      .min(VALIDATION_LIMITS.MIN_DIMENSION, 'Height is too small')
      .max(VALIDATION_LIMITS.MAX_DIMENSION, 'Height exceeds maximum limit')
      .multipleOf(0.01)
  }).refine(
    dim => dim.width / dim.height <= 5 && dim.height / dim.width <= 5,
    'Aspect ratio must be between 1:5 and 5:1'
  )
});

/**
 * Enhanced schema for floor plan update requests
 * Supports partial updates with validation
 */
export const updateFloorPlanSchema = createFloorPlanSchema.partial().extend({
  id: z.string().uuid('Invalid floor plan ID')
});

/**
 * Enhanced schema for entity placement validation
 * Includes boundary and scale validation
 */
export const entityPlacementSchema = z.object({
  entityId: z.string()
    .regex(/^[\w_]+\.[\w_]+$/, 'Invalid entity ID format'),
  x: z.number()
    .min(0, 'X coordinate must be positive')
    .multipleOf(0.01),
  y: z.number()
    .min(0, 'Y coordinate must be positive')
    .multipleOf(0.01),
  scale: z.number()
    .min(VALIDATION_LIMITS.MIN_SCALE, 'Scale factor too small')
    .max(VALIDATION_LIMITS.MAX_SCALE, 'Scale factor too large')
    .multipleOf(0.01)
});

/**
 * Validates and sanitizes the request body for creating a new floor plan
 * @param requestBody - The request body to validate
 * @returns Promise<boolean>
 * @throws FloorPlanValidationError
 */
export async function validateCreateFloorPlanRequest(
  requestBody: unknown
): Promise<boolean> {
  try {
    const validationResult = createFloorPlanSchema.safeParse(requestBody);

    if (!validationResult.success) {
      throw new FloorPlanValidationError({
        code: 'INVALID_FLOOR_PLAN_DATA',
        message: 'Floor plan validation failed',
        field: validationResult.error.errors[0]?.path.join('.') || 'unknown',
        details: validationResult.error.errors
      });
    }

    // Additional SVG security validation
    const svgValidation = await validateSVGSecurity(validationResult.data.svgData);
    if (!svgValidation.isValid) {
      throw new FloorPlanValidationError({
        code: 'SVG_SECURITY_ERROR',
        message: 'SVG security validation failed',
        field: 'svgData',
        details: svgValidation.errors
      });
    }

    return true;
  } catch (error) {
    if (error instanceof FloorPlanValidationError) {
      throw error;
    }
    throw new FloorPlanValidationError({
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown validation error',
      field: 'unknown'
    });
  }
}

/**
 * Validates and sanitizes the request body for updating an existing floor plan
 * @param requestBody - The request body to validate
 * @returns Promise<boolean>
 * @throws FloorPlanValidationError
 */
export async function validateUpdateFloorPlanRequest(
  requestBody: unknown
): Promise<boolean> {
  try {
    const validationResult = updateFloorPlanSchema.safeParse(requestBody);

    if (!validationResult.success) {
      throw new FloorPlanValidationError({
        code: 'INVALID_UPDATE_DATA',
        message: 'Floor plan update validation failed',
        field: validationResult.error.errors[0]?.path.join('.') || 'unknown',
        details: validationResult.error.errors
      });
    }

    if (validationResult.data.svgData) {
      const svgValidation = await validateSVGSecurity(validationResult.data.svgData);
      if (!svgValidation.isValid) {
        throw new FloorPlanValidationError({
          code: 'SVG_SECURITY_ERROR',
          message: 'SVG security validation failed',
          field: 'svgData',
          details: svgValidation.errors
        });
      }
    }

    return true;
  } catch (error) {
    if (error instanceof FloorPlanValidationError) {
      throw error;
    }
    throw new FloorPlanValidationError({
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown validation error',
      field: 'unknown'
    });
  }
}

/**
 * Validates entity placement requests with enhanced coordinate and boundary checking
 * @param requestBody - The request body to validate
 * @returns Promise<boolean>
 * @throws FloorPlanValidationError
 */
export async function validateEntityPlacementRequest(
  requestBody: unknown
): Promise<boolean> {
  try {
    const validationResult = entityPlacementSchema.safeParse(requestBody);

    if (!validationResult.success) {
      throw new FloorPlanValidationError({
        code: 'INVALID_ENTITY_PLACEMENT',
        message: 'Entity placement validation failed',
        field: validationResult.error.errors[0]?.path.join('.') || 'unknown',
        details: validationResult.error.errors
      });
    }

    // Validate coordinates against floor plan dimensions
    const { x, y, scale } = validationResult.data;
    const floorPlan = await validateFloorPlan({
      dimensions: { width: x, height: y }
    } as IFloorPlan);

    if (!floorPlan.isValid) {
      throw new FloorPlanValidationError({
        code: 'COORDINATE_OUT_OF_BOUNDS',
        message: 'Entity placement coordinates exceed floor plan boundaries',
        field: 'coordinates',
        details: { x, y, scale }
      });
    }

    return true;
  } catch (error) {
    if (error instanceof FloorPlanValidationError) {
      throw error;
    }
    throw new FloorPlanValidationError({
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown validation error',
      field: 'unknown'
    });
  }
}

/**
 * Validates SVG content for security vulnerabilities
 * @param svgData - The SVG content to validate
 * @returns Promise<{ isValid: boolean; errors?: string[] }>
 */
async function validateSVGSecurity(
  svgData: string
): Promise<{ isValid: boolean; errors?: string[] }> {
  const errors: string[] = [];

  // Check for malicious patterns
  SVG_SECURITY.DISALLOWED_PATTERNS.forEach(pattern => {
    if (pattern.test(svgData)) {
      errors.push(`SVG contains potentially unsafe pattern: ${pattern.source}`);
    }
  });

  // Validate SVG structure
  if (!SVG_SECURITY.ALLOWED_TAGS.test(svgData)) {
    errors.push('Invalid SVG structure');
  }

  // Check file size
  if (new Blob([svgData]).size > VALIDATION_LIMITS.MAX_SVG_SIZE) {
    errors.push('SVG file size exceeds maximum limit');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
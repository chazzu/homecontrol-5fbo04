import { z } from 'zod'; // v3.0.0
import { FloorPlan } from '../types/floorPlan.types';
import { EntityConfig } from '../types/entity.types';
import { PluginManifest } from '../types/plugin.types';

// Performance optimization: Cache validation schemas
const schemaCache = new Map<string, z.ZodSchema>();

/**
 * Custom error class for validation failures
 */
class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for security-related validation failures
 */
class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Performance monitoring utility
 */
const measurePerformance = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    if (duration > 100) {
      console.warn(`Performance warning: ${operationName} took ${duration}ms`);
    }
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`${operationName} failed after ${duration}ms:`, error);
    throw error;
  }
};

/**
 * Validates floor plan data structure with enhanced security and performance
 */
export const validateFloorPlan = async (floorPlan: FloorPlan): Promise<boolean> => {
  return measurePerformance(async () => {
    const cacheKey = 'floorPlan';
    let schema = schemaCache.get(cacheKey);

    if (!schema) {
      schema = z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(255),
        svgData: z.string().min(1).max(2 * 1024 * 1024), // 2MB max
        dimensions: z.object({
          width: z.number().positive().max(10000),
          height: z.number().positive().max(10000),
          aspectRatio: z.number().positive()
        }),
        scale: z.number().positive(),
        order: z.number().int().min(0),
        entityPlacements: z.instanceof(Map),
        metadata: z.object({
          createdAt: z.string(),
          updatedAt: z.string(),
          createdBy: z.string(),
          customData: z.record(z.unknown())
        })
      });
      schemaCache.set(cacheKey, schema);
    }

    try {
      await schema.parseAsync(floorPlan);
      await validateSVGContent(floorPlan.svgData);
      return true;
    } catch (error) {
      throw new ValidationError(
        'Floor plan validation failed',
        'INVALID_FLOOR_PLAN',
        { error }
      );
    }
  }, 'validateFloorPlan');
};

/**
 * Validates entity configuration with security checks
 */
export const validateEntityConfig = async (config: EntityConfig): Promise<boolean> => {
  return measurePerformance(async () => {
    const cacheKey = 'entityConfig';
    let schema = schemaCache.get(cacheKey);

    if (!schema) {
      schema = z.object({
        entity_id: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+$/),
        type: z.enum(['light', 'switch', 'climate', 'media_player', 'sensor', 
                     'binary_sensor', 'camera', 'cover', 'fan', 'lock']),
        position: z.object({
          x: z.number().min(0).max(10000),
          y: z.number().min(0).max(10000),
          scale: z.number().positive().max(10),
          rotation: z.number().min(0).max(360)
        }),
        floor_id: z.string(),
        visible: z.boolean(),
        custom_settings: z.record(z.unknown()),
        display_name: z.string().nullable(),
        icon_override: z.string().nullable()
      });
      schemaCache.set(cacheKey, schema);
    }

    try {
      await schema.parseAsync(config);
      return true;
    } catch (error) {
      throw new ValidationError(
        'Entity configuration validation failed',
        'INVALID_ENTITY_CONFIG',
        { error }
      );
    }
  }, 'validateEntityConfig');
};

/**
 * Validates plugin manifest with security checks and version verification
 */
export const validatePluginManifest = async (manifest: PluginManifest): Promise<boolean> => {
  return measurePerformance(async () => {
    const cacheKey = 'pluginManifest';
    let schema = schemaCache.get(cacheKey);

    if (!schema) {
      schema = z.object({
        id: z.string().regex(/^[a-z0-9-_]+$/),
        name: z.string().min(1).max(100),
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
        type: z.enum(['entity_component', 'icon_pack', 'utility']),
        entryPoint: z.string().startsWith('./'),
        description: z.string().max(500),
        author: z.string().max(100)
      });
      schemaCache.set(cacheKey, schema);
    }

    try {
      await schema.parseAsync(manifest);
      return true;
    } catch (error) {
      throw new ValidationError(
        'Plugin manifest validation failed',
        'INVALID_PLUGIN_MANIFEST',
        { error }
      );
    }
  }, 'validatePluginManifest');
};

/**
 * Validates and sanitizes SVG content for security
 */
export const validateSVGContent = async (svgData: string): Promise<boolean> => {
  return measurePerformance(async () => {
    // Size validation
    if (svgData.length > 2 * 1024 * 1024) { // 2MB limit
      throw new SecurityError(
        'SVG content exceeds size limit',
        'SVG_SIZE_EXCEEDED'
      );
    }

    // Security checks
    const securityRisks = [
      /<script/i,
      /javascript:/i,
      /data:/i,
      /on[a-z]+=/i,
      /xlink:href/i
    ];

    for (const risk of securityRisks) {
      if (risk.test(svgData)) {
        throw new SecurityError(
          'SVG contains potentially malicious content',
          'SVG_SECURITY_RISK',
          { pattern: risk.source }
        );
      }
    }

    // Structure validation
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgData, 'image/svg+xml');
      const parserErrors = doc.getElementsByTagName('parsererror');

      if (parserErrors.length > 0) {
        throw new ValidationError(
          'Invalid SVG structure',
          'INVALID_SVG_STRUCTURE',
          { errors: Array.from(parserErrors).map(error => error.textContent) }
        );
      }

      // Validate root element
      const rootElement = doc.documentElement;
      if (rootElement.tagName.toLowerCase() !== 'svg') {
        throw new ValidationError(
          'Invalid root element',
          'INVALID_SVG_ROOT'
        );
      }

      return true;
    } catch (error) {
      throw new ValidationError(
        'SVG parsing failed',
        'SVG_PARSE_ERROR',
        { error }
      );
    }
  }, 'validateSVGContent');
};
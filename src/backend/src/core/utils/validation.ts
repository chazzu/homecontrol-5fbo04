import { z } from 'zod'; // v3.0+
import { 
  HAWebSocketMessage, 
  HAMessageType, 
  HAEventType, 
  HAEntityDomain,
  HA_MESSAGE_TYPES,
  HA_EVENT_TYPES,
  HA_DOMAINS
} from '../types/homeAssistant';
import { IFloorPlan, EntityPlacement } from '../interfaces/IFloorPlan';
import { IPlugin, PluginState } from '../interfaces/IPlugin';

// Constants for validation limits and security thresholds
const VALIDATION_CONSTANTS = {
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB
  MAX_SVG_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_ENTITIES_PER_PLAN: 1000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_VALIDATIONS_PER_WINDOW: 1000,
  VALIDATION_TIMEOUT: 5000, // 5 seconds
} as const;

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  details?: Record<string, any>;
}

// Rate limiting state
const rateLimitState = {
  validationCount: 0,
  windowStart: Date.now(),
};

// Schema Definitions
const haMessageSchema = z.object({
  type: z.enum(Object.values(HA_MESSAGE_TYPES) as [HAMessageType, ...HAMessageType[]]),
  id: z.number().optional(),
  payload: z.unknown().optional(),
}).refine(data => {
  const size = JSON.stringify(data).length;
  return size <= VALIDATION_CONSTANTS.MAX_MESSAGE_SIZE;
}, {
  message: `Message size exceeds maximum limit of ${VALIDATION_CONSTANTS.MAX_MESSAGE_SIZE} bytes`
});

const entityPlacementSchema = z.object({
  entityId: z.string().min(1),
  x: z.number().min(0),
  y: z.number().min(0),
  scale: z.number().positive().max(10),
});

const floorPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  svgData: z.string().min(1).refine(
    svg => svg.startsWith('<svg') && svg.endsWith('</svg>'),
    { message: 'Invalid SVG format' }
  ),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  scale: z.number().positive(),
  order: z.number().int().min(0),
  entityPlacements: z.array(entityPlacementSchema).max(VALIDATION_CONSTANTS.MAX_ENTITIES_PER_PLAN),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const pluginSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  state: z.nativeEnum(PluginState),
  description: z.string(),
  author: z.string(),
  config: z.record(z.unknown()),
});

// Utility functions
function resetRateLimit() {
  const now = Date.now();
  if (now - rateLimitState.windowStart >= VALIDATION_CONSTANTS.RATE_LIMIT_WINDOW) {
    rateLimitState.validationCount = 0;
    rateLimitState.windowStart = now;
  }
}

function checkRateLimit(): boolean {
  resetRateLimit();
  return rateLimitState.validationCount < VALIDATION_CONSTANTS.MAX_VALIDATIONS_PER_WINDOW;
}

function incrementRateLimit() {
  resetRateLimit();
  rateLimitState.validationCount++;
}

// Validation cache for floor plans
const floorPlanValidationCache = new Map<string, ValidationResult>();

/**
 * Validates Home Assistant WebSocket message structure and content
 * @param message - The message to validate
 * @returns Promise<ValidationResult>
 */
export async function validateHAMessage(message: HAWebSocketMessage): Promise<ValidationResult> {
  if (!checkRateLimit()) {
    return {
      isValid: false,
      errors: ['Rate limit exceeded for validation requests'],
    };
  }

  try {
    const validationPromise = new Promise<ValidationResult>((resolve) => {
      const result = haMessageSchema.safeParse(message);
      
      if (!result.success) {
        resolve({
          isValid: false,
          errors: result.error.errors.map(err => err.message),
        });
        return;
      }

      // Additional type-specific validation
      if (message.type === 'auth') {
        const { payload } = message;
        if (!payload || typeof payload !== 'object' || !('access_token' in payload)) {
          resolve({
            isValid: false,
            errors: ['Invalid authentication message format'],
          });
          return;
        }
      }

      incrementRateLimit();
      resolve({
        isValid: true,
        errors: [],
        details: { messageType: message.type },
      });
    });

    return Promise.race([
      validationPromise,
      new Promise<ValidationResult>((resolve) => {
        setTimeout(() => {
          resolve({
            isValid: false,
            errors: ['Validation timeout exceeded'],
          });
        }, VALIDATION_CONSTANTS.VALIDATION_TIMEOUT);
      }),
    ]);
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Validates floor plan data structure and content
 * @param floorPlan - The floor plan to validate
 * @returns Promise<ValidationResult>
 */
export async function validateFloorPlan(floorPlan: IFloorPlan): Promise<ValidationResult> {
  if (!checkRateLimit()) {
    return {
      isValid: false,
      errors: ['Rate limit exceeded for validation requests'],
    };
  }

  // Check cache first
  const cacheKey = `${floorPlan.id}-${floorPlan.updatedAt.getTime()}`;
  const cachedResult = floorPlanValidationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const result = floorPlanSchema.safeParse(floorPlan);
    
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(err => err.message),
      };
    }

    // Validate SVG size
    if (floorPlan.svgData.length > VALIDATION_CONSTANTS.MAX_SVG_SIZE) {
      return {
        isValid: false,
        errors: [`SVG data exceeds maximum size of ${VALIDATION_CONSTANTS.MAX_SVG_SIZE} bytes`],
      };
    }

    // Validate entity placement bounds
    const invalidPlacements = floorPlan.entityPlacements.filter(
      placement => placement.x > floorPlan.dimensions.width || 
                  placement.y > floorPlan.dimensions.height
    );

    if (invalidPlacements.length > 0) {
      return {
        isValid: false,
        errors: ['Entity placements exceed floor plan dimensions'],
        details: { invalidPlacements },
      };
    }

    const validationResult = {
      isValid: true,
      errors: [],
      details: {
        entityCount: floorPlan.entityPlacements.length,
        dimensions: floorPlan.dimensions,
      },
    };

    // Cache the validation result
    floorPlanValidationCache.set(cacheKey, validationResult);
    incrementRateLimit();

    return validationResult;
  } catch (error) {
    return {
      isValid: false,
      errors: [`Floor plan validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Validates plugin structure and security
 * @param plugin - The plugin to validate
 * @returns Promise<ValidationResult>
 */
export async function validatePlugin(plugin: IPlugin): Promise<ValidationResult> {
  if (!checkRateLimit()) {
    return {
      isValid: false,
      errors: ['Rate limit exceeded for validation requests'],
    };
  }

  try {
    const result = pluginSchema.safeParse(plugin);
    
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(err => err.message),
      };
    }

    // Validate required methods
    const requiredMethods = ['initialize', 'cleanup'];
    const missingMethods = requiredMethods.filter(
      method => !(method in plugin && typeof plugin[method as keyof IPlugin] === 'function')
    );

    if (missingMethods.length > 0) {
      return {
        isValid: false,
        errors: [`Missing required plugin methods: ${missingMethods.join(', ')}`],
      };
    }

    // Security validation
    const securityChecks = {
      hasEval: plugin.toString().includes('eval('),
      hasFunction: plugin.toString().includes('Function('),
      hasImport: plugin.toString().includes('import('),
    };

    if (Object.values(securityChecks).some(check => check)) {
      return {
        isValid: false,
        errors: ['Plugin contains potentially unsafe code'],
        details: { securityChecks },
      };
    }

    incrementRateLimit();
    return {
      isValid: true,
      errors: [],
      details: {
        pluginId: plugin.id,
        version: plugin.version,
        state: plugin.state,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Plugin validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
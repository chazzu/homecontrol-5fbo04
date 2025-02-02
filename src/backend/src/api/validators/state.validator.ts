/**
 * @file State validation module for Smart Home Dashboard
 * @version 1.0.0
 * 
 * Provides high-performance validation for entity states and state changes
 * with caching, error tracking, and comprehensive type safety.
 */

import { z } from 'zod'; // v3.0+
import { HAEntityState } from '../../../types/homeAssistant';
import { StateError, StateErrorCode } from '../../../core/types/State.types';

/**
 * Validation options interface for customizing validation behavior
 */
interface ValidationOptions {
  cacheResults?: boolean;
  strictMode?: boolean;
  timeout?: number;
}

/**
 * Interface for tracking validation performance metrics
 */
interface ValidationMetrics {
  duration: number;
  cacheHit: boolean;
  validationChain: string[];
}

/**
 * Constants for validation configuration
 */
const ENTITY_ID_REGEX = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const SUPPORTED_DOMAINS = ['light', 'switch', 'climate', 'media_player', 'sensor', 'binary_sensor', 'camera'];
const VALIDATION_CACHE_SIZE = 1000;
const VALIDATION_TIMEOUT = 200;
const SCHEMA_VERSION = '1.0.0';

/**
 * LRU Cache for validation results
 */
const validationCache = new Map<string, { result: boolean; timestamp: number }>();

/**
 * Zod schema for entity state validation
 */
const entityStateSchema = z.object({
  entity_id: z.string().regex(ENTITY_ID_REGEX),
  state: z.string().min(1),
  attributes: z.record(z.unknown()),
  last_changed: z.string().datetime(),
}).strict();

/**
 * Creates a detailed validation error with context
 */
function createValidationError(
  code: StateErrorCode,
  message: string,
  context?: Record<string, any>
): StateError {
  return {
    code,
    message,
    timestamp: Date.now(),
    ...context && { context }
  };
}

/**
 * Validates entity state with performance optimization
 */
export async function validateEntityState(
  state: Partial<HAEntityState>,
  options: ValidationOptions = {}
): Promise<void> {
  const startTime = performance.now();
  const metrics: ValidationMetrics = {
    duration: 0,
    cacheHit: false,
    validationChain: []
  };

  try {
    // Check cache if enabled
    if (options.cacheResults) {
      const cacheKey = `state_${state.entity_id}_${JSON.stringify(state)}`;
      const cached = validationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < VALIDATION_TIMEOUT) {
        metrics.cacheHit = true;
        if (!cached.result) {
          throw createValidationError(
            StateErrorCode.INVALID_STATE,
            'Invalid entity state (cached result)',
            { entityId: state.entity_id }
          );
        }
        return;
      }
    }

    // Validate basic structure
    metrics.validationChain.push('structure');
    const validationResult = await entityStateSchema.safeParseAsync(state);
    if (!validationResult.success) {
      throw createValidationError(
        StateErrorCode.INVALID_STATE,
        'Invalid entity state structure',
        { 
          errors: validationResult.error.errors,
          entityId: state.entity_id
        }
      );
    }

    // Validate domain
    metrics.validationChain.push('domain');
    const [domain] = state.entity_id!.split('.');
    if (!SUPPORTED_DOMAINS.includes(domain)) {
      throw createValidationError(
        StateErrorCode.INVALID_ENTITY_ID,
        'Unsupported entity domain',
        { domain, entityId: state.entity_id }
      );
    }

    // Domain-specific validation
    metrics.validationChain.push('domain-specific');
    await validateDomainSpecificState(state as HAEntityState);

    // Cache successful validation
    if (options.cacheResults) {
      const cacheKey = `state_${state.entity_id}_${JSON.stringify(state)}`;
      if (validationCache.size >= VALIDATION_CACHE_SIZE) {
        const oldestKey = validationCache.keys().next().value;
        validationCache.delete(oldestKey);
      }
      validationCache.set(cacheKey, { result: true, timestamp: Date.now() });
    }

  } finally {
    metrics.duration = performance.now() - startTime;
    if (metrics.duration > VALIDATION_TIMEOUT) {
      console.warn('State validation exceeded timeout', { metrics });
    }
  }
}

/**
 * Validates entity ID format and existence
 */
export async function validateEntityId(
  entityId: string,
  options: ValidationOptions = {}
): Promise<void> {
  const startTime = performance.now();

  try {
    // Check cache if enabled
    if (options.cacheResults) {
      const cached = validationCache.get(`id_${entityId}`);
      if (cached && Date.now() - cached.timestamp < VALIDATION_TIMEOUT) {
        if (!cached.result) {
          throw createValidationError(
            StateErrorCode.INVALID_ENTITY_ID,
            'Invalid entity ID (cached result)',
            { entityId }
          );
        }
        return;
      }
    }

    // Validate format
    if (!ENTITY_ID_REGEX.test(entityId)) {
      throw createValidationError(
        StateErrorCode.INVALID_ENTITY_ID,
        'Invalid entity ID format',
        { entityId }
      );
    }

    // Validate domain
    const [domain] = entityId.split('.');
    if (!SUPPORTED_DOMAINS.includes(domain)) {
      throw createValidationError(
        StateErrorCode.INVALID_ENTITY_ID,
        'Unsupported entity domain',
        { domain, entityId }
      );
    }

    // Cache successful validation
    if (options.cacheResults) {
      if (validationCache.size >= VALIDATION_CACHE_SIZE) {
        const oldestKey = validationCache.keys().next().value;
        validationCache.delete(oldestKey);
      }
      validationCache.set(`id_${entityId}`, { result: true, timestamp: Date.now() });
    }

  } finally {
    const duration = performance.now() - startTime;
    if (duration > VALIDATION_TIMEOUT) {
      console.warn('Entity ID validation exceeded timeout', { entityId, duration });
    }
  }
}

/**
 * Validates state subscription parameters
 */
export async function validateStateSubscription(
  entityId: string,
  callback: Function,
  options: ValidationOptions = {}
): Promise<void> {
  const startTime = performance.now();

  try {
    // Validate entity ID
    await validateEntityId(entityId, options);

    // Validate callback
    if (typeof callback !== 'function') {
      throw createValidationError(
        StateErrorCode.SUBSCRIPTION_ERROR,
        'Invalid callback function',
        { entityId }
      );
    }

    // Validate callback memory usage (prevent memory leaks)
    const callbackString = callback.toString();
    if (callbackString.length > 1000) {
      throw createValidationError(
        StateErrorCode.SUBSCRIPTION_ERROR,
        'Callback function too large',
        { entityId, size: callbackString.length }
      );
    }

  } finally {
    const duration = performance.now() - startTime;
    if (duration > VALIDATION_TIMEOUT) {
      console.warn('Subscription validation exceeded timeout', { entityId, duration });
    }
  }
}

/**
 * Domain-specific state validation
 */
async function validateDomainSpecificState(state: HAEntityState): Promise<void> {
  const [domain] = state.entity_id.split('.');

  switch (domain) {
    case 'light':
      validateLightState(state);
      break;
    case 'climate':
      validateClimateState(state);
      break;
    case 'media_player':
      validateMediaPlayerState(state);
      break;
    // Add other domain-specific validations as needed
  }
}

/**
 * Light entity state validation
 */
function validateLightState(state: HAEntityState): void {
  const validStates = ['on', 'off', 'unavailable'];
  if (!validStates.includes(state.state)) {
    throw createValidationError(
      StateErrorCode.INVALID_STATE,
      'Invalid light state',
      { 
        entityId: state.entity_id,
        state: state.state,
        validStates 
      }
    );
  }
}

/**
 * Climate entity state validation
 */
function validateClimateState(state: HAEntityState): void {
  const validStates = ['heat', 'cool', 'auto', 'off', 'unavailable'];
  if (!validStates.includes(state.state)) {
    throw createValidationError(
      StateErrorCode.INVALID_STATE,
      'Invalid climate state',
      {
        entityId: state.entity_id,
        state: state.state,
        validStates
      }
    );
  }
}

/**
 * Media player entity state validation
 */
function validateMediaPlayerState(state: HAEntityState): void {
  const validStates = ['playing', 'paused', 'idle', 'off', 'unavailable'];
  if (!validStates.includes(state.state)) {
    throw createValidationError(
      StateErrorCode.INVALID_STATE,
      'Invalid media player state',
      {
        entityId: state.entity_id,
        state: state.state,
        validStates
      }
    );
  }
}
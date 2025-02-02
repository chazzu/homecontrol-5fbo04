/**
 * @file Entity Management Utility Module
 * @version 1.0.0
 * 
 * Core utility module providing comprehensive entity management functions for smart home devices.
 * Includes robust type detection, validation, state transformation, and performance-optimized operations.
 */

import { EntityType, EntityConfig } from '../types/entity.types';

// Global constants for entity validation and caching
const SUPPORTED_DOMAINS = new Set(['light', 'switch', 'climate', 'media_player', 'sensor', 'binary_sensor', 'camera']);
const ENTITY_ID_REGEX = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const DOMAIN_CACHE = new Map<string, string>();
const MAX_ENTITY_ID_LENGTH = 100;

/**
 * Extracts and validates the domain from an entity ID with performance optimization through caching.
 * 
 * @param entityId - The entity ID to extract domain from (format: domain.entity)
 * @returns The validated domain string
 * @throws Error if entity ID is invalid
 */
export function getEntityDomain(entityId: string): string {
  // Check cache first for performance optimization
  const cachedDomain = DOMAIN_CACHE.get(entityId);
  if (cachedDomain) {
    return cachedDomain;
  }

  // Validate input
  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Entity ID must be a non-empty string');
  }

  // Validate length
  if (entityId.length > MAX_ENTITY_ID_LENGTH) {
    throw new Error(`Entity ID exceeds maximum length of ${MAX_ENTITY_ID_LENGTH} characters`);
  }

  // Validate format
  if (!ENTITY_ID_REGEX.test(entityId)) {
    throw new Error('Invalid entity ID format. Expected format: domain.entity');
  }

  // Extract domain
  const [domain] = entityId.split('.');
  
  // Validate domain is alphanumeric
  if (!/^[a-z0-9_]+$/.test(domain)) {
    throw new Error('Domain must contain only lowercase letters, numbers, and underscores');
  }

  // Cache and return domain
  DOMAIN_CACHE.set(entityId, domain);
  return domain;
}

/**
 * Maps entity domain to corresponding EntityType with comprehensive error handling.
 * 
 * @param entityId - The entity ID to get type for
 * @returns The corresponding EntityType enum value
 * @throws Error if entity type is not supported
 */
export function getEntityType(entityId: string): EntityType {
  const domain = getEntityDomain(entityId);

  if (!SUPPORTED_DOMAINS.has(domain)) {
    throw new Error(`Unsupported entity domain: ${domain}`);
  }

  // Map domain to EntityType using type guards
  switch (domain) {
    case 'light':
      return EntityType.LIGHT;
    case 'switch':
      return EntityType.SWITCH;
    case 'climate':
      return EntityType.CLIMATE;
    case 'media_player':
      return EntityType.MEDIA_PLAYER;
    case 'sensor':
      return EntityType.SENSOR;
    case 'binary_sensor':
      return EntityType.BINARY_SENSOR;
    case 'camera':
      return EntityType.CAMERA;
    default:
      throw new Error(`Unable to map domain ${domain} to EntityType`);
  }
}

/**
 * Efficiently checks if an entity type is supported using Set data structure.
 * 
 * @param entityId - The entity ID to check
 * @returns True if entity type is supported, false otherwise
 */
export function isEntitySupported(entityId: string): boolean {
  try {
    const domain = getEntityDomain(entityId);
    return SUPPORTED_DOMAINS.has(domain);
  } catch (error) {
    return false;
  }
}

/**
 * Performs comprehensive entity ID validation with security checks.
 * 
 * @param entityId - The entity ID to validate
 * @returns True if entity ID is valid, false otherwise
 */
export function validateEntityId(entityId: string): boolean {
  try {
    // Basic input validation
    if (!entityId || typeof entityId !== 'string') {
      return false;
    }

    // Length check
    if (entityId.length > MAX_ENTITY_ID_LENGTH) {
      return false;
    }

    // Format validation
    if (!ENTITY_ID_REGEX.test(entityId)) {
      return false;
    }

    // Split and validate segments
    const [domain, entity] = entityId.split('.');
    
    // Check for empty segments
    if (!domain || !entity) {
      return false;
    }

    // Validate domain and entity segments
    if (!/^[a-z0-9_]+$/.test(domain) || !/^[a-z0-9_]+$/.test(entity)) {
      return false;
    }

    // Check domain support
    return SUPPORTED_DOMAINS.has(domain);
  } catch (error) {
    return false;
  }
}
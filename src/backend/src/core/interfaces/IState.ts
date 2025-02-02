/**
 * @file IState interface definition for Smart Home Dashboard state management
 * @version 1.0.0
 * 
 * Defines the contract for state management operations with comprehensive error handling,
 * real-time updates (< 200ms latency), and subscription management capabilities.
 */

import { HAEntityState } from '../../types/homeAssistant';
import { StateChangeCallback, StateError } from '../types/State.types';

/**
 * Interface defining the contract for state management operations with comprehensive
 * error handling, performance optimizations, and subscription management.
 * 
 * Implements requirements:
 * - Real-time state synchronization with < 200ms latency
 * - Comprehensive error handling with type safety
 * - Efficient state caching and bulk operations
 * - Memory-safe subscription management
 */
export interface IState {
  /**
   * Retrieves the current state of a specific entity.
   * 
   * @param entityId - The unique identifier of the entity (format: domain.name)
   * @returns Promise resolving to the entity's current state
   * @throws StateError with code:
   *  - STATE_NOT_FOUND: Entity does not exist
   *  - INVALID_ENTITY_ID: Invalid entity ID format
   *  - STATE_UPDATE_TIMEOUT: State retrieval exceeded 200ms threshold
   */
  getState(entityId: string): Promise<HAEntityState>;

  /**
   * Retrieves the current states of all entities with optimized bulk fetching.
   * Implements caching for improved performance while maintaining state consistency.
   * 
   * @returns Promise resolving to array of all entity states
   * @throws StateError with code:
   *  - STATE_UPDATE_TIMEOUT: Bulk state retrieval exceeded 200ms threshold
   */
  getAllStates(): Promise<HAEntityState[]>;

  /**
   * Updates the state of a specific entity with validation and partial update support.
   * Ensures real-time propagation with < 200ms latency requirement.
   * 
   * @param entityId - The unique identifier of the entity to update
   * @param state - Partial state update with type-safe attributes
   * @throws StateError with code:
   *  - INVALID_ENTITY_ID: Invalid entity ID format
   *  - INVALID_STATE: Invalid state update payload
   *  - STATE_UPDATE_TIMEOUT: Update exceeded 200ms threshold
   */
  setState(entityId: string, state: Partial<HAEntityState>): Promise<void>;

  /**
   * Subscribes to state changes for a specific entity with automatic cleanup
   * and memory management. Ensures real-time updates with < 200ms latency.
   * 
   * @param entityId - The unique identifier of the entity to subscribe to
   * @param callback - Function to handle state changes with error support
   * @throws StateError with code:
   *  - INVALID_ENTITY_ID: Invalid entity ID format
   *  - SUBSCRIPTION_ERROR: Failed to create subscription
   */
  subscribeToState(entityId: string, callback: StateChangeCallback): Promise<void>;

  /**
   * Unsubscribes from state changes for a specific entity with subscription tracking.
   * Implements memory-safe cleanup of inactive subscriptions.
   * 
   * @param entityId - The unique identifier of the entity to unsubscribe from
   * @param callback - The callback function to remove from subscription
   * @throws StateError with code:
   *  - INVALID_ENTITY_ID: Invalid entity ID format
   *  - SUBSCRIPTION_ERROR: Failed to remove subscription
   */
  unsubscribeFromState(entityId: string, callback: StateChangeCallback): Promise<void>;
}
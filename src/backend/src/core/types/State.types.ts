/**
 * @file State management type definitions for Smart Home Dashboard
 * @version 1.0.0
 * 
 * Provides comprehensive TypeScript type definitions for state management,
 * including entity states, state changes, error handling, and subscription patterns
 * with strict type safety and real-time update support.
 */

import { HAEntityState } from '../../types/homeAssistant';

/**
 * Enumeration of all possible state error codes for type-safe error handling
 */
export enum StateErrorCode {
  STATE_NOT_FOUND = 'STATE_NOT_FOUND',
  INVALID_STATE = 'INVALID_STATE',
  SUBSCRIPTION_ERROR = 'SUBSCRIPTION_ERROR',
  STATE_UPDATE_TIMEOUT = 'STATE_UPDATE_TIMEOUT',
  INVALID_ENTITY_ID = 'INVALID_ENTITY_ID'
}

/**
 * Comprehensive error type for state-related issues with detailed context
 */
export type StateError = {
  /** Error code from StateErrorCode enum */
  readonly code: StateErrorCode;
  /** Human-readable error message */
  readonly message: string;
  /** Unix timestamp of when the error occurred */
  readonly timestamp: number;
  /** Optional entity ID associated with the error */
  readonly entityId?: string;
};

/**
 * Type-safe callback function for handling state changes with error handling support
 * Ensures < 200ms latency requirement for real-time updates
 */
export type StateChangeCallback = (
  state: HAEntityState,
  error?: StateError
) => void;

/**
 * Enhanced interface for managing state change subscriptions with tracking capabilities
 * Supports real-time state synchronization with comprehensive tracking
 */
export interface StateSubscription {
  /** Unique identifier of the entity being subscribed to */
  readonly entityId: string;
  /** Callback function for handling state changes */
  readonly callback: StateChangeCallback;
  /** Unique identifier for the subscription instance */
  readonly subscriptionId: string;
  /** Timestamp of the last state update for latency tracking */
  readonly lastUpdated: number;
}

/**
 * Type guard to check if an error is a StateError
 */
export function isStateError(error: unknown): error is StateError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'timestamp' in error &&
    Object.values(StateErrorCode).includes((error as StateError).code)
  );
}

/**
 * Type guard to check if a subscription is valid
 */
export function isValidSubscription(subscription: unknown): subscription is StateSubscription {
  return (
    typeof subscription === 'object' &&
    subscription !== null &&
    'entityId' in subscription &&
    'callback' in subscription &&
    'subscriptionId' in subscription &&
    'lastUpdated' in subscription &&
    typeof (subscription as StateSubscription).entityId === 'string' &&
    typeof (subscription as StateSubscription).subscriptionId === 'string' &&
    typeof (subscription as StateSubscription).lastUpdated === 'number' &&
    typeof (subscription as StateSubscription).callback === 'function'
  );
}

/**
 * Readonly record of error messages for consistent error reporting
 */
export const STATE_ERROR_MESSAGES: Readonly<Record<StateErrorCode, string>> = {
  [StateErrorCode.STATE_NOT_FOUND]: 'Entity state not found',
  [StateErrorCode.INVALID_STATE]: 'Invalid entity state received',
  [StateErrorCode.SUBSCRIPTION_ERROR]: 'Failed to create state subscription',
  [StateErrorCode.STATE_UPDATE_TIMEOUT]: 'State update exceeded 200ms latency threshold',
  [StateErrorCode.INVALID_ENTITY_ID]: 'Invalid entity ID format'
} as const;
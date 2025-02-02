/**
 * @file StateService.ts
 * @version 1.0.0
 * 
 * Service implementation for managing entity states in the Smart Home Dashboard.
 * Provides real-time state synchronization, caching, and subscription management
 * with comprehensive error handling and performance optimizations.
 */

import { injectable } from 'inversify'; // v6.0.1
import { IState } from '../interfaces/IState';
import { HAEntityState } from '../../types/homeAssistant';
import { StateChangeCallback, StateError, StateErrorCode } from '../types/State.types';
import { WebSocketManager } from '../WebSocketManager';

@injectable()
export class StateService implements IState {
  private readonly stateCache: Map<string, { state: HAEntityState; timestamp: number }>;
  private readonly subscriptions: Map<string, Set<StateChangeCallback>>;
  private readonly CACHE_DURATION = 5000; // 5 seconds cache validity
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly BATCH_UPDATE_DELAY = 100; // 100ms batching delay

  constructor(private readonly wsManager: WebSocketManager) {
    this.stateCache = new Map();
    this.subscriptions = new Map();
    this.setupStateChangeHandler();
    this.setupReconnectionHandler();
  }

  /**
   * Retrieves current state of an entity with caching and automatic refresh
   */
  public async getState(entityId: string): Promise<HAEntityState> {
    this.validateEntityId(entityId);

    // Check cache first
    const cached = this.stateCache.get(entityId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.state;
    }

    try {
      const response = await this.wsManager.sendMessage({
        type: 'get_states',
        entity_id: entityId
      });

      if (!response || !response.result) {
        throw new Error(StateErrorCode.STATE_NOT_FOUND);
      }

      const state = response.result as HAEntityState;
      this.updateCache(entityId, state);
      return state;

    } catch (error) {
      throw new StateError({
        code: StateErrorCode.STATE_NOT_FOUND,
        message: `Failed to retrieve state for entity: ${entityId}`,
        details: { entityId, error }
      });
    }
  }

  /**
   * Retrieves states of all entities with batch processing
   */
  public async getAllStates(): Promise<HAEntityState[]> {
    try {
      const response = await this.wsManager.sendMessage({
        type: 'get_states'
      });

      if (!response || !response.result) {
        throw new Error(StateErrorCode.STATE_NOT_FOUND);
      }

      const states = response.result as HAEntityState[];
      states.forEach(state => this.updateCache(state.entity_id, state));
      return states;

    } catch (error) {
      throw new StateError({
        code: StateErrorCode.STATE_UPDATE_TIMEOUT,
        message: 'Failed to retrieve all states',
        details: { error }
      });
    }
  }

  /**
   * Updates entity state with retry mechanism and validation
   */
  public async setState(
    entityId: string,
    state: Partial<HAEntityState>
  ): Promise<void> {
    this.validateEntityId(entityId);
    this.validateState(state);

    let attempts = 0;
    while (attempts < this.MAX_RETRY_ATTEMPTS) {
      try {
        const response = await this.wsManager.sendMessage({
          type: 'call_service',
          domain: entityId.split('.')[0],
          service: 'set_state',
          target: { entity_id: entityId },
          service_data: state
        });

        if (!response.success) {
          throw new Error(response.error?.message || 'State update failed');
        }

        // Update cache and notify subscribers
        const newState = { ...await this.getState(entityId), ...state };
        this.updateCache(entityId, newState);
        this.notifySubscribers(entityId, newState);
        return;

      } catch (error) {
        attempts++;
        if (attempts === this.MAX_RETRY_ATTEMPTS) {
          throw new StateError({
            code: StateErrorCode.STATE_UPDATE_TIMEOUT,
            message: `Failed to update state for entity: ${entityId}`,
            details: { entityId, state, error }
          });
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  /**
   * Subscribes to state changes with automatic cleanup
   */
  public async subscribeToState(
    entityId: string,
    callback: StateChangeCallback
  ): Promise<void> {
    this.validateEntityId(entityId);

    if (!this.subscriptions.has(entityId)) {
      this.subscriptions.set(entityId, new Set());
      await this.setupEntitySubscription(entityId);
    }

    this.subscriptions.get(entityId)!.add(callback);

    // Initialize with current state
    try {
      const currentState = await this.getState(entityId);
      callback(currentState);
    } catch (error) {
      console.warn(`Failed to get initial state for ${entityId}:`, error);
    }
  }

  /**
   * Handles subscription removal and cleanup
   */
  public async unsubscribeFromState(
    entityId: string,
    callback: StateChangeCallback
  ): Promise<void> {
    this.validateEntityId(entityId);

    const subscribers = this.subscriptions.get(entityId);
    if (!subscribers) return;

    subscribers.delete(callback);

    if (subscribers.size === 0) {
      this.subscriptions.delete(entityId);
      await this.cleanupEntitySubscription(entityId);
    }
  }

  /**
   * Sets up WebSocket handler for state changes
   */
  private setupStateChangeHandler(): void {
    this.wsManager.subscribeToEvents('state_changed', (event) => {
      if (event.event_type === 'state_changed' && event.data) {
        const { entity_id, new_state } = event.data;
        if (new_state) {
          this.updateCache(entity_id, new_state);
          this.notifySubscribers(entity_id, new_state);
        }
      }
    });
  }

  /**
   * Handles WebSocket reconnection
   */
  private setupReconnectionHandler(): void {
    this.wsManager.onReconnect(async () => {
      // Refresh all cached states
      const entityIds = Array.from(this.stateCache.keys());
      for (const entityId of entityIds) {
        try {
          await this.getState(entityId);
        } catch (error) {
          console.warn(`Failed to refresh state for ${entityId}:`, error);
        }
      }
    });
  }

  /**
   * Updates state cache with timestamp
   */
  private updateCache(entityId: string, state: HAEntityState): void {
    this.stateCache.set(entityId, {
      state,
      timestamp: Date.now()
    });
  }

  /**
   * Notifies subscribers of state changes
   */
  private notifySubscribers(entityId: string, state: HAEntityState): void {
    const subscribers = this.subscriptions.get(entityId);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error(`Error in state change callback for ${entityId}:`, error);
        }
      });
    }
  }

  /**
   * Sets up WebSocket subscription for entity
   */
  private async setupEntitySubscription(entityId: string): Promise<void> {
    try {
      await this.wsManager.subscribeToEvents('state_changed', (event) => {
        if (event.data?.entity_id === entityId) {
          this.updateCache(entityId, event.data.new_state);
          this.notifySubscribers(entityId, event.data.new_state);
        }
      });
    } catch (error) {
      throw new StateError({
        code: StateErrorCode.SUBSCRIPTION_ERROR,
        message: `Failed to setup subscription for entity: ${entityId}`,
        details: { entityId, error }
      });
    }
  }

  /**
   * Cleans up WebSocket subscription for entity
   */
  private async cleanupEntitySubscription(entityId: string): Promise<void> {
    try {
      await this.wsManager.unsubscribeFromEvents(
        parseInt(entityId.split('.')[1], 10)
      );
    } catch (error) {
      console.warn(`Failed to cleanup subscription for ${entityId}:`, error);
    }
  }

  /**
   * Validates entity ID format
   */
  private validateEntityId(entityId: string): void {
    if (!entityId || !entityId.includes('.')) {
      throw new StateError({
        code: StateErrorCode.INVALID_ENTITY_ID,
        message: 'Invalid entity ID format',
        details: { entityId }
      });
    }
  }

  /**
   * Validates state update payload
   */
  private validateState(state: Partial<HAEntityState>): void {
    if (!state || typeof state !== 'object') {
      throw new StateError({
        code: StateErrorCode.INVALID_STATE,
        message: 'Invalid state update payload',
        details: { state }
      });
    }
  }
}
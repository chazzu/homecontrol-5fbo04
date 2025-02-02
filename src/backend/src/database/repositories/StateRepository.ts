/**
 * @file StateRepository implementation for Smart Home Dashboard state management
 * @version 1.0.0
 * 
 * Implements high-performance state management with:
 * - Real-time synchronization (< 200ms latency)
 * - Comprehensive error handling
 * - Memory-efficient subscription management
 * - Performance monitoring and metrics
 */

import { EventEmitter } from 'events'; // v1.0.0
import { StateModel } from '../models/State';
import { IState } from '../../core/interfaces/IState';
import { HAEntityState } from '../../types/homeAssistant';
import {
  StateError,
  StateErrorCode,
  STATE_ERROR_MESSAGES,
  StateChangeCallback
} from '../../core/types/State.types';

export class StateRepository implements IState {
  private readonly stateModel: typeof StateModel;
  private readonly eventEmitter: EventEmitter;
  private readonly subscriptions: Map<string, Set<StateChangeCallback>>;
  private readonly operationMetrics: Map<string, number[]>;
  private readonly MAX_SUBSCRIBERS = 100;
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly PERFORMANCE_THRESHOLD = 200; // 200ms latency threshold

  constructor() {
    this.stateModel = StateModel;
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(this.MAX_SUBSCRIBERS);
    this.subscriptions = new Map();
    this.operationMetrics = new Map();

    // Initialize performance monitoring
    setInterval(() => this.cleanupStaleSubscriptions(), this.CLEANUP_INTERVAL);
  }

  /**
   * Retrieves current state of an entity with performance tracking
   */
  public async getState(entityId: string): Promise<HAEntityState> {
    const startTime = Date.now();
    
    try {
      if (!entityId.includes('.')) {
        throw this.createError(
          StateErrorCode.INVALID_ENTITY_ID,
          entityId
        );
      }

      const state = await this.stateModel.findByEntityId(entityId);
      
      const latency = Date.now() - startTime;
      this.recordMetric('getState', latency);

      if (latency > this.PERFORMANCE_THRESHOLD) {
        console.warn(`getState latency exceeded threshold: ${latency}ms for ${entityId}`);
      }

      return state;
    } catch (error) {
      throw this.handleError(error, entityId);
    }
  }

  /**
   * Retrieves states of all entities with batch processing
   */
  public async getAllStates(): Promise<HAEntityState[]> {
    const startTime = Date.now();
    const batchSize = 100;
    const states: HAEntityState[] = [];

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.stateModel.getAllStates(page, batchSize);
        states.push(...batch);
        hasMore = batch.length === batchSize;
        page++;
      }

      const latency = Date.now() - startTime;
      this.recordMetric('getAllStates', latency);

      if (latency > this.PERFORMANCE_THRESHOLD) {
        console.warn(`getAllStates latency exceeded threshold: ${latency}ms`);
      }

      return states;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Updates state of an entity with real-time notification
   */
  public async setState(
    entityId: string,
    newState: Partial<HAEntityState>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      if (!entityId.includes('.')) {
        throw this.createError(
          StateErrorCode.INVALID_ENTITY_ID,
          entityId
        );
      }

      if (!newState || typeof newState !== 'object') {
        throw this.createError(
          StateErrorCode.INVALID_STATE,
          entityId
        );
      }

      await this.stateModel.bulkUpdateStates([
        { ...newState, entity_id: entityId } as HAEntityState
      ]);

      const latency = Date.now() - startTime;
      this.recordMetric('setState', latency);

      if (latency > this.PERFORMANCE_THRESHOLD) {
        console.warn(`setState latency exceeded threshold: ${latency}ms for ${entityId}`);
      }

      // Notify subscribers with debouncing
      this.notifyStateChange(entityId, newState as HAEntityState);
    } catch (error) {
      throw this.handleError(error, entityId);
    }
  }

  /**
   * Subscribes to state changes with subscription management
   */
  public async subscribeToState(
    entityId: string,
    callback: StateChangeCallback
  ): Promise<void> {
    try {
      if (!entityId.includes('.')) {
        throw this.createError(
          StateErrorCode.INVALID_ENTITY_ID,
          entityId
        );
      }

      if (!this.subscriptions.has(entityId)) {
        this.subscriptions.set(entityId, new Set());
      }

      const subscribers = this.subscriptions.get(entityId)!;

      if (subscribers.size >= this.MAX_SUBSCRIBERS) {
        throw this.createError(
          StateErrorCode.SUBSCRIPTION_ERROR,
          entityId,
          'Maximum subscribers reached'
        );
      }

      subscribers.add(callback);
      this.eventEmitter.on(entityId, callback);
    } catch (error) {
      throw this.handleError(error, entityId);
    }
  }

  /**
   * Unsubscribes from state changes with cleanup
   */
  public async unsubscribeFromState(
    entityId: string,
    callback: StateChangeCallback
  ): Promise<void> {
    try {
      if (!this.subscriptions.has(entityId)) {
        return;
      }

      const subscribers = this.subscriptions.get(entityId)!;
      subscribers.delete(callback);
      this.eventEmitter.removeListener(entityId, callback);

      if (subscribers.size === 0) {
        this.subscriptions.delete(entityId);
      }
    } catch (error) {
      throw this.handleError(error, entityId);
    }
  }

  /**
   * Private helper methods
   */
  private createError(
    code: StateErrorCode,
    entityId?: string,
    customMessage?: string
  ): StateError {
    return {
      code,
      message: customMessage || STATE_ERROR_MESSAGES[code],
      timestamp: Date.now(),
      entityId
    };
  }

  private handleError(error: unknown, entityId?: string): StateError {
    if ((error as StateError).code) {
      return error as StateError;
    }

    return this.createError(
      StateErrorCode.STATE_UPDATE_TIMEOUT,
      entityId,
      (error as Error).message
    );
  }

  private recordMetric(operation: string, latency: number): void {
    if (!this.operationMetrics.has(operation)) {
      this.operationMetrics.set(operation, []);
    }

    const metrics = this.operationMetrics.get(operation)!;
    metrics.push(latency);

    // Keep only last 1000 measurements
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  private notifyStateChange(entityId: string, state: HAEntityState): void {
    if (!this.subscriptions.has(entityId)) {
      return;
    }

    // Debounce notifications to prevent overwhelming subscribers
    setTimeout(() => {
      this.eventEmitter.emit(entityId, state);
    }, 0);
  }

  private cleanupStaleSubscriptions(): void {
    for (const [entityId, subscribers] of this.subscriptions.entries()) {
      if (subscribers.size === 0) {
        this.subscriptions.delete(entityId);
      }
    }

    // Clear old metrics
    for (const [operation, metrics] of this.operationMetrics.entries()) {
      if (metrics.length > 1000) {
        this.operationMetrics.set(operation, metrics.slice(-1000));
      }
    }
  }
}
/**
 * @file StateManager.ts
 * @version 1.0.0
 * 
 * Core state manager implementing real-time state synchronization between
 * Home Assistant and the Smart Home Dashboard with comprehensive error handling,
 * performance optimization, and security validation.
 */

import { injectable } from 'inversify'; // v6.0.1
import { EventEmitter } from 'events'; // v3.0.0
import { IState } from './interfaces/IState';
import { HAEntityState } from '../types/homeAssistant';
import { StateService } from './services/StateService';
import { WebSocketManager } from './WebSocketManager';
import { StateChangeCallback, StateError, StateErrorCode } from './types/State.types';

/**
 * Configuration for retry mechanism with exponential backoff
 */
interface RetryConfiguration {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * Performance metrics tracking
 */
interface PerformanceMetrics {
  stateUpdateLatency: number;
  cacheHitRate: number;
  batchSize: number;
  lastUpdateTimestamp: number;
}

/**
 * Batch state processor for optimizing updates
 */
class BatchStateProcessor {
  private batch: Map<string, HAEntityState> = new Map();
  private processingTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL = 100; // 100ms batching window

  constructor(private readonly processCallback: (states: Map<string, HAEntityState>) => void) {}

  public queueState(entityId: string, state: HAEntityState): void {
    this.batch.set(entityId, state);
    
    if (!this.processingTimeout) {
      this.processingTimeout = setTimeout(() => this.processBatch(), this.BATCH_INTERVAL);
    }
  }

  private processBatch(): void {
    if (this.batch.size > 0) {
      this.processCallback(new Map(this.batch));
      this.batch.clear();
    }
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }
}

/**
 * Connection state monitoring
 */
class ConnectionStateMonitor {
  private lastHeartbeat: number = Date.now();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 second heartbeat

  constructor(private readonly onDisconnect: () => void) {
    this.startMonitoring();
  }

  public updateHeartbeat(): void {
    this.lastHeartbeat = Date.now();
  }

  private startMonitoring(): void {
    setInterval(() => {
      if (Date.now() - this.lastHeartbeat > this.HEARTBEAT_INTERVAL) {
        this.onDisconnect();
      }
    }, this.HEARTBEAT_INTERVAL / 2);
  }
}

/**
 * State security validator
 */
class StateSecurityValidator {
  public validateStateUpdate(state: Partial<HAEntityState>): void {
    if (!state || typeof state !== 'object') {
      throw new StateError({
        code: StateErrorCode.INVALID_STATE,
        message: 'Invalid state update payload',
        timestamp: Date.now()
      });
    }

    // Validate state attributes for potential security risks
    if (state.attributes) {
      this.validateAttributes(state.attributes);
    }
  }

  private validateAttributes(attributes: Record<string, any>): void {
    // Prevent JavaScript injection in attributes
    JSON.stringify(attributes, (_, value) => {
      if (typeof value === 'string' && value.includes('javascript:')) {
        throw new StateError({
          code: StateErrorCode.INVALID_STATE,
          message: 'Potential security risk in state attributes',
          timestamp: Date.now()
        });
      }
      return value;
    });
  }
}

/**
 * Core state manager implementing real-time state synchronization
 * with comprehensive error handling and performance optimization
 */
@injectable()
export class StateManager implements IState {
  private readonly stateCache: Map<string, { state: HAEntityState; timestamp: number }>;
  private readonly subscriptions: Map<string, Set<StateChangeCallback>>;
  private readonly eventEmitter: EventEmitter;
  private readonly retryConfig: RetryConfiguration;
  private readonly metrics: PerformanceMetrics;
  private readonly batchProcessor: BatchStateProcessor;
  private readonly connectionMonitor: ConnectionStateMonitor;
  private readonly securityValidator: StateSecurityValidator;

  constructor(
    private readonly stateService: StateService,
    private readonly wsManager: WebSocketManager
  ) {
    this.stateCache = new Map();
    this.subscriptions = new Map();
    this.eventEmitter = new EventEmitter();
    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000
    };
    this.metrics = {
      stateUpdateLatency: 0,
      cacheHitRate: 0,
      batchSize: 0,
      lastUpdateTimestamp: Date.now()
    };
    this.batchProcessor = new BatchStateProcessor(this.processBatchedStates.bind(this));
    this.connectionMonitor = new ConnectionStateMonitor(this.handleDisconnection.bind(this));
    this.securityValidator = new StateSecurityValidator();

    this.setupEventHandlers();
  }

  /**
   * Initializes the state manager and establishes connections
   */
  public async initialize(): Promise<void> {
    try {
      await this.wsManager.connect();
      await this.loadInitialStates();
      this.startMetricsCollection();
    } catch (error) {
      throw new StateError({
        code: StateErrorCode.STATE_NOT_FOUND,
        message: 'Failed to initialize state manager',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Retrieves current state of an entity with caching
   */
  public async getState(entityId: string): Promise<HAEntityState> {
    this.validateEntityId(entityId);

    const cached = this.stateCache.get(entityId);
    if (cached && Date.now() - cached.timestamp < 5000) {
      this.updateMetrics('cacheHit');
      return cached.state;
    }

    try {
      const startTime = Date.now();
      const state = await this.stateService.getState(entityId);
      this.updateMetrics('stateUpdate', Date.now() - startTime);
      
      this.stateCache.set(entityId, {
        state,
        timestamp: Date.now()
      });

      return state;
    } catch (error) {
      throw new StateError({
        code: StateErrorCode.STATE_NOT_FOUND,
        message: `Failed to retrieve state for entity: ${entityId}`,
        timestamp: Date.now(),
        entityId
      });
    }
  }

  /**
   * Retrieves states of all entities with batch processing
   */
  public async getAllStates(): Promise<HAEntityState[]> {
    try {
      const startTime = Date.now();
      const states = await this.stateService.getAllStates();
      this.updateMetrics('batchUpdate', Date.now() - startTime);

      states.forEach(state => {
        this.stateCache.set(state.entity_id, {
          state,
          timestamp: Date.now()
        });
      });

      return states;
    } catch (error) {
      throw new StateError({
        code: StateErrorCode.STATE_UPDATE_TIMEOUT,
        message: 'Failed to retrieve all states',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Updates entity state with validation and batching
   */
  public async setState(
    entityId: string,
    state: Partial<HAEntityState>
  ): Promise<void> {
    this.validateEntityId(entityId);
    this.securityValidator.validateStateUpdate(state);

    let attempts = 0;
    while (attempts < this.retryConfig.maxAttempts) {
      try {
        const startTime = Date.now();
        await this.stateService.setState(entityId, state);
        this.updateMetrics('stateUpdate', Date.now() - startTime);

        const newState = await this.getState(entityId);
        this.batchProcessor.queueState(entityId, newState);
        return;
      } catch (error) {
        attempts++;
        if (attempts === this.retryConfig.maxAttempts) {
          throw new StateError({
            code: StateErrorCode.STATE_UPDATE_TIMEOUT,
            message: `Failed to update state for entity: ${entityId}`,
            timestamp: Date.now(),
            entityId
          });
        }
        await new Promise(resolve => 
          setTimeout(resolve, Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempts),
            this.retryConfig.maxDelay
          ))
        );
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
    }

    this.subscriptions.get(entityId)!.add(callback);

    try {
      const currentState = await this.getState(entityId);
      callback(currentState);
    } catch (error) {
      console.warn(`Failed to get initial state for ${entityId}:`, error);
    }
  }

  /**
   * Unsubscribes from state changes
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
    }
  }

  /**
   * Sets up event handlers for state changes
   */
  private setupEventHandlers(): void {
    this.eventEmitter.on('stateChange', (entityId: string, state: HAEntityState) => {
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
    });

    this.wsManager.subscribeToEvents('state_changed', event => {
      if (event.data?.entity_id && event.data?.new_state) {
        this.batchProcessor.queueState(event.data.entity_id, event.data.new_state);
      }
    });
  }

  /**
   * Processes batched state updates
   */
  private processBatchedStates(states: Map<string, HAEntityState>): void {
    states.forEach((state, entityId) => {
      this.stateCache.set(entityId, {
        state,
        timestamp: Date.now()
      });
      this.eventEmitter.emit('stateChange', entityId, state);
    });
  }

  /**
   * Handles WebSocket disconnection
   */
  private async handleDisconnection(): Promise<void> {
    try {
      await this.wsManager.connect();
      await this.loadInitialStates();
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  }

  /**
   * Loads initial states on startup
   */
  private async loadInitialStates(): Promise<void> {
    try {
      const states = await this.getAllStates();
      states.forEach(state => {
        this.stateCache.set(state.entity_id, {
          state,
          timestamp: Date.now()
        });
      });
    } catch (error) {
      console.error('Failed to load initial states:', error);
    }
  }

  /**
   * Updates performance metrics
   */
  private updateMetrics(type: 'stateUpdate' | 'cacheHit' | 'batchUpdate', duration?: number): void {
    const now = Date.now();
    
    switch (type) {
      case 'stateUpdate':
        this.metrics.stateUpdateLatency = duration || 0;
        this.metrics.lastUpdateTimestamp = now;
        break;
      case 'cacheHit':
        this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
        break;
      case 'batchUpdate':
        this.metrics.batchSize = duration || 0;
        break;
    }
  }

  /**
   * Starts collecting performance metrics
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.connectionMonitor.updateHeartbeat();
    }, 30000);
  }

  /**
   * Validates entity ID format
   */
  private validateEntityId(entityId: string): void {
    if (!entityId || !entityId.includes('.')) {
      throw new StateError({
        code: StateErrorCode.INVALID_ENTITY_ID,
        message: 'Invalid entity ID format',
        timestamp: Date.now(),
        entityId
      });
    }
  }
}
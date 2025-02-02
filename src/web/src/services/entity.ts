import { EntityType, EntityConfig } from '../types/entity.types';
import { WebSocketService } from './websocket';
import { StorageService } from './storage';
import { HassEntity } from 'home-assistant-js-websocket'; // v8.0.1

// Constants for entity service configuration
const ENTITY_STORAGE_KEY = 'entity_configurations';
const ENTITY_STATE_UPDATE_EVENT = 'entity_state_changed';
const MAX_RETRY_ATTEMPTS = 3;
const CACHE_DURATION = 300000; // 5 minutes
const STATE_UPDATE_BATCH_SIZE = 50;

interface EntityCache {
  data: Map<string, HassEntity>;
  timestamp: number;
}

interface RetryConfig {
  count: number;
  lastAttempt: number;
  backoffMultiplier: number;
}

/**
 * Service class for managing smart home entities with enhanced error handling,
 * caching, and real-time synchronization
 */
export class EntityService {
  private webSocketService: WebSocketService;
  private storageService: StorageService;
  private entityConfigs: Map<string, EntityConfig>;
  private entityStates: Map<string, HassEntity>;
  private retryAttempts: Map<string, RetryConfig>;
  private stateCache: EntityCache;
  private stateSubscriptions: Map<string, Set<(state: HassEntity) => void>>;
  private batchUpdateTimeout?: NodeJS.Timeout;

  constructor(webSocketService: WebSocketService, storageService: StorageService) {
    this.webSocketService = webSocketService;
    this.storageService = storageService;
    this.entityConfigs = new Map();
    this.entityStates = new Map();
    this.retryAttempts = new Map();
    this.stateCache = {
      data: new Map(),
      timestamp: 0
    };
    this.stateSubscriptions = new Map();
  }

  /**
   * Initialize entity service with configuration loading and state synchronization
   */
  public async initialize(): Promise<void> {
    try {
      // Load stored entity configurations
      await this.loadEntityConfigurations();

      // Subscribe to entity state updates
      this.subscribeToStateUpdates();

      // Initialize state cache
      await this.refreshStateCache();

    } catch (error) {
      console.error('Failed to initialize entity service:', error);
      throw error;
    }
  }

  /**
   * Get entity configuration with validation
   */
  public getEntityConfig(entityId: string): EntityConfig | null {
    return this.entityConfigs.get(entityId) || null;
  }

  /**
   * Set entity configuration with validation and persistence
   */
  public async setEntityConfig(entityId: string, config: EntityConfig): Promise<void> {
    try {
      // Validate entity configuration
      if (!this.validateEntityConfig(config)) {
        throw new Error('Invalid entity configuration');
      }

      this.entityConfigs.set(entityId, config);
      await this.persistEntityConfigurations();

    } catch (error) {
      console.error('Failed to set entity configuration:', error);
      throw error;
    }
  }

  /**
   * Get current entity state with caching
   */
  public getEntityState(entityId: string): HassEntity | null {
    const cachedState = this.stateCache.data.get(entityId);
    if (cachedState && Date.now() - this.stateCache.timestamp < CACHE_DURATION) {
      return cachedState;
    }
    return this.entityStates.get(entityId) || null;
  }

  /**
   * Subscribe to entity state changes
   */
  public subscribeToEntity(
    entityId: string,
    callback: (state: HassEntity) => void
  ): () => void {
    if (!this.stateSubscriptions.has(entityId)) {
      this.stateSubscriptions.set(entityId, new Set());
    }
    
    this.stateSubscriptions.get(entityId)!.add(callback);
    
    return () => {
      const callbacks = this.stateSubscriptions.get(entityId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.stateSubscriptions.delete(entityId);
        }
      }
    };
  }

  /**
   * Control entity with retry mechanism
   */
  public async controlEntity(
    entityId: string,
    command: string,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    const config = this.getEntityConfig(entityId);
    if (!config) {
      throw new Error('Entity configuration not found');
    }

    try {
      await this.webSocketService.callService({
        domain: config.type,
        service: command,
        target: { entity_id: entityId },
        serviceData: data
      });

      // Reset retry count on success
      this.retryAttempts.delete(entityId);

    } catch (error) {
      await this.handleControlError(entityId, command, data, error);
    }
  }

  /**
   * Batch update entity states for improved performance
   */
  private async batchUpdateStates(
    updates: Map<string, HassEntity>
  ): Promise<void> {
    if (this.batchUpdateTimeout) {
      clearTimeout(this.batchUpdateTimeout);
    }

    this.batchUpdateTimeout = setTimeout(async () => {
      try {
        const updateBatches: Map<string, HassEntity>[] = [];
        let currentBatch = new Map<string, HassEntity>();
        
        for (const [entityId, state] of updates) {
          currentBatch.set(entityId, state);
          
          if (currentBatch.size >= STATE_UPDATE_BATCH_SIZE) {
            updateBatches.push(currentBatch);
            currentBatch = new Map();
          }
        }
        
        if (currentBatch.size > 0) {
          updateBatches.push(currentBatch);
        }

        for (const batch of updateBatches) {
          await this.processStateBatch(batch);
        }

      } catch (error) {
        console.error('Failed to process state updates:', error);
      }
    }, 0);
  }

  /**
   * Process a batch of state updates
   */
  private async processStateBatch(
    batch: Map<string, HassEntity>
  ): Promise<void> {
    for (const [entityId, state] of batch) {
      this.entityStates.set(entityId, state);
      this.stateCache.data.set(entityId, state);
      
      // Notify subscribers
      const subscribers = this.stateSubscriptions.get(entityId);
      if (subscribers) {
        subscribers.forEach(callback => {
          try {
            callback(state);
          } catch (error) {
            console.error('Error in state subscription callback:', error);
          }
        });
      }
    }
    
    this.stateCache.timestamp = Date.now();
  }

  /**
   * Handle entity control errors with retry mechanism
   */
  private async handleControlError(
    entityId: string,
    command: string,
    data: Record<string, unknown>,
    error: unknown
  ): Promise<void> {
    let retryConfig = this.retryAttempts.get(entityId) || {
      count: 0,
      lastAttempt: 0,
      backoffMultiplier: 1.5
    };

    if (retryConfig.count < MAX_RETRY_ATTEMPTS) {
      retryConfig.count++;
      retryConfig.lastAttempt = Date.now();
      this.retryAttempts.set(entityId, retryConfig);

      const backoffTime = 1000 * Math.pow(retryConfig.backoffMultiplier, retryConfig.count - 1);
      await new Promise(resolve => setTimeout(resolve, backoffTime));

      return this.controlEntity(entityId, command, data);
    }

    throw error;
  }

  /**
   * Load entity configurations from storage
   */
  private async loadEntityConfigurations(): Promise<void> {
    try {
      const stored = this.storageService.getItem<Record<string, EntityConfig>>(ENTITY_STORAGE_KEY);
      if (stored) {
        this.entityConfigs = new Map(Object.entries(stored));
      }
    } catch (error) {
      console.error('Failed to load entity configurations:', error);
      throw error;
    }
  }

  /**
   * Persist entity configurations to storage
   */
  private async persistEntityConfigurations(): Promise<void> {
    try {
      const configObject = Object.fromEntries(this.entityConfigs);
      this.storageService.setItem(ENTITY_STORAGE_KEY, configObject);
    } catch (error) {
      console.error('Failed to persist entity configurations:', error);
      throw error;
    }
  }

  /**
   * Subscribe to entity state updates via WebSocket
   */
  private subscribeToStateUpdates(): void {
    this.webSocketService.subscribe('state_changed', message => {
      if (message.type === 'event' && message.payload.event_type === 'state_changed') {
        const { entity_id, new_state } = message.payload.data;
        if (new_state) {
          const updates = new Map([[entity_id, new_state]]);
          this.batchUpdateStates(updates);
        }
      }
    });
  }

  /**
   * Refresh entity state cache
   */
  private async refreshStateCache(): Promise<void> {
    try {
      const message = {
        type: 'get_states',
        id: Date.now()
      };

      const response = await this.webSocketService.sendMessage(message);
      const states = new Map<string, HassEntity>();
      
      for (const state of response) {
        states.set(state.entity_id, state);
      }

      this.stateCache = {
        data: states,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Failed to refresh state cache:', error);
      throw error;
    }
  }

  /**
   * Validate entity configuration
   */
  private validateEntityConfig(config: EntityConfig): boolean {
    return (
      typeof config.entity_id === 'string' &&
      Object.values(EntityType).includes(config.type) &&
      typeof config.position === 'object' &&
      typeof config.position.x === 'number' &&
      typeof config.position.y === 'number' &&
      typeof config.position.scale === 'number'
    );
  }
}
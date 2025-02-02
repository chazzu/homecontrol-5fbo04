import mongoose, { Schema, Document, Model } from 'mongoose';
import { HAEntityState } from '../../types/homeAssistant';
import { IState } from '../../core/interfaces/IState';
import { StateError, StateErrorCode } from '../../core/types/State.types';

/**
 * Interface for State document with performance metrics
 */
interface IStateDocument extends Document, HAEntityState {
  sync_status: 'pending' | 'synced' | 'error';
  update_latency: number;
  last_sync_attempt: Date;
  cache_hit_count: number;
}

/**
 * Interface for State model with performance-optimized methods
 */
interface IStateModel extends Model<IStateDocument> {
  findByEntityId(entityId: string): Promise<HAEntityState>;
  bulkUpdateStates(states: HAEntityState[]): Promise<void>;
  getAllStates(page?: number, limit?: number): Promise<HAEntityState[]>;
}

/**
 * Schema definition for State model with performance-optimized indexes
 */
const StateSchema = new Schema<IStateDocument>({
  entity_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  state: {
    type: String,
    required: true
  },
  attributes: {
    type: Schema.Types.Mixed,
    default: {}
  },
  last_updated: {
    type: Date,
    required: true,
    index: true
  },
  last_changed: {
    type: Date,
    required: true
  },
  sync_status: {
    type: String,
    enum: ['pending', 'synced', 'error'],
    default: 'pending',
    index: true
  },
  update_latency: {
    type: Number,
    default: 0
  },
  last_sync_attempt: {
    type: Date,
    default: Date.now
  },
  cache_hit_count: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: false
});

// Performance-optimized compound indexes
StateSchema.index({ entity_id: 1, sync_status: 1 });
StateSchema.index({ last_updated: -1, sync_status: 1 });

// Cache implementation for frequently accessed states
const stateCache = new Map<string, { state: HAEntityState; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds cache TTL

/**
 * Optimized method to find state by entity ID with caching
 */
StateSchema.statics.findByEntityId = async function(
  entityId: string
): Promise<HAEntityState> {
  const startTime = Date.now();

  // Check cache first
  const cached = stateCache.get(entityId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    await this.updateOne(
      { entity_id: entityId },
      { $inc: { cache_hit_count: 1 } }
    );
    return cached.state;
  }

  const state = await this.findOne({ entity_id: entityId });
  if (!state) {
    throw new Error(STATE_ERROR_MESSAGES[StateErrorCode.STATE_NOT_FOUND]);
  }

  // Update performance metrics
  const latency = Date.now() - startTime;
  await state.updateOne({
    update_latency: latency,
    last_sync_attempt: new Date()
  });

  // Cache the result
  stateCache.set(entityId, {
    state: state.toObject(),
    timestamp: Date.now()
  });

  return state.toObject();
};

/**
 * Optimized bulk state update with performance monitoring
 */
StateSchema.statics.bulkUpdateStates = async function(
  states: HAEntityState[]
): Promise<void> {
  const startTime = Date.now();
  const bulkOps = states.map(state => ({
    updateOne: {
      filter: { entity_id: state.entity_id },
      update: {
        $set: {
          ...state,
          sync_status: 'synced',
          last_sync_attempt: new Date(),
          last_updated: new Date()
        }
      },
      upsert: true
    }
  }));

  await this.bulkWrite(bulkOps, { ordered: false });

  // Update cache for all changed states
  states.forEach(state => {
    stateCache.set(state.entity_id, {
      state,
      timestamp: Date.now()
    });
  });

  const latency = Date.now() - startTime;
  if (latency > 200) {
    console.warn(`Bulk update exceeded 200ms latency threshold: ${latency}ms`);
  }
};

/**
 * Optimized method to get all states with pagination
 */
StateSchema.statics.getAllStates = async function(
  page: number = 1,
  limit: number = 100
): Promise<HAEntityState[]> {
  const startTime = Date.now();

  const states = await this.find()
    .sort({ last_updated: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const latency = Date.now() - startTime;
  if (latency > 200) {
    console.warn(`getAllStates exceeded 200ms latency threshold: ${latency}ms`);
  }

  return states;
};

// Middleware for performance monitoring
StateSchema.pre('save', function(next) {
  const startTime = Date.now();
  this.last_sync_attempt = new Date();
  
  next();

  const latency = Date.now() - startTime;
  this.update_latency = latency;
});

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of stateCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      stateCache.delete(key);
    }
  }
}, CACHE_TTL);

export const StateModel = mongoose.model<IStateDocument, IStateModel>('State', StateSchema);
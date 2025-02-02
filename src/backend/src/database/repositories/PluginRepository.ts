import mongoose from 'mongoose'; // v7.0.0
import NodeCache from 'node-cache'; // v5.1.2
import { Plugin } from '../models/Plugin';
import { IPlugin } from '../../core/interfaces/IPlugin';
import { PluginState } from '../../core/types/Plugin.types';

/**
 * Repository class for managing plugin data persistence with optimized performance
 * and enhanced error handling capabilities.
 */
export class PluginRepository {
    private readonly pluginModel: mongoose.Model<IPlugin & mongoose.Document>;
    private readonly cache: NodeCache;
    private readonly CACHE_TTL = 300; // 5 minutes cache TTL
    private readonly CACHE_CHECK_PERIOD = 60; // Check for expired cache entries every minute

    constructor() {
        this.pluginModel = Plugin;
        this.cache = new NodeCache({
            stdTTL: this.CACHE_TTL,
            checkperiod: this.CACHE_CHECK_PERIOD,
            useClones: false
        });

        // Initialize cache event handlers
        this.initializeCacheHandlers();
    }

    /**
     * Creates a new plugin record with validation and error handling
     * @param plugin - Plugin data to create
     * @returns Promise resolving to created plugin
     * @throws {Error} If validation fails or database operation errors
     */
    async create(plugin: IPlugin): Promise<IPlugin> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const newPlugin = new this.pluginModel(plugin);
            await newPlugin.validate();

            const savedPlugin = await newPlugin.save({ session });
            this.cache.set(savedPlugin.id, savedPlugin);

            await session.commitTransaction();
            return savedPlugin.toObject();
        } catch (error) {
            await session.abortTransaction();
            throw this.handleDatabaseError(error);
        } finally {
            session.endSession();
        }
    }

    /**
     * Finds a plugin by ID with caching support
     * @param id - Plugin identifier
     * @returns Promise resolving to found plugin or null
     */
    async findById(id: string): Promise<IPlugin | null> {
        const cached = this.cache.get<IPlugin>(id);
        if (cached) return cached;

        const plugin = await this.pluginModel.findOne({ id }).exec();
        if (plugin) {
            this.cache.set(id, plugin.toObject());
            return plugin.toObject();
        }
        return null;
    }

    /**
     * Retrieves all plugins with pagination and filtering support
     * @param options - Pagination and filtering options
     * @returns Promise resolving to paginated plugins and total count
     */
    async findAll(options: {
        page?: number;
        limit?: number;
        state?: PluginState;
        search?: string;
    } = {}): Promise<{ plugins: IPlugin[]; total: number }> {
        const {
            page = 1,
            limit = 10,
            state,
            search
        } = options;

        const query: any = {};
        if (state) query.state = state;
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        const skip = (page - 1) * limit;
        const cacheKey = `plugins:${JSON.stringify(options)}`;
        const cached = this.cache.get<{ plugins: IPlugin[]; total: number }>(cacheKey);

        if (cached) return cached;

        const [plugins, total] = await Promise.all([
            this.pluginModel
                .find(query)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.pluginModel.countDocuments(query)
        ]);

        const result = {
            plugins: plugins.map(p => p.toObject()),
            total
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    /**
     * Updates a plugin with transaction support and cache invalidation
     * @param id - Plugin identifier
     * @param updateData - Partial plugin data to update
     * @returns Promise resolving to updated plugin or null
     * @throws {Error} If validation fails or database operation errors
     */
    async update(id: string, updateData: Partial<IPlugin>): Promise<IPlugin | null> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const plugin = await this.pluginModel.findOneAndUpdate(
                { id },
                { $set: updateData },
                { 
                    new: true,
                    runValidators: true,
                    session 
                }
            );

            if (!plugin) {
                await session.abortTransaction();
                return null;
            }

            this.cache.del(id);
            this.invalidateListCache();

            await session.commitTransaction();
            return plugin.toObject();
        } catch (error) {
            await session.abortTransaction();
            throw this.handleDatabaseError(error);
        } finally {
            session.endSession();
        }
    }

    /**
     * Soft deletes a plugin with state management
     * @param id - Plugin identifier
     * @returns Promise resolving to deletion success status
     */
    async delete(id: string): Promise<boolean> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const plugin = await this.pluginModel.findOneAndUpdate(
                { id },
                { 
                    $set: { 
                        state: PluginState.INACTIVE,
                        deletedAt: new Date()
                    }
                },
                { session }
            );

            if (!plugin) {
                await session.abortTransaction();
                return false;
            }

            this.cache.del(id);
            this.invalidateListCache();

            await session.commitTransaction();
            return true;
        } catch (error) {
            await session.abortTransaction();
            throw this.handleDatabaseError(error);
        } finally {
            session.endSession();
        }
    }

    /**
     * Initializes cache event handlers for monitoring and cleanup
     * @private
     */
    private initializeCacheHandlers(): void {
        this.cache.on('expired', (key: string) => {
            console.debug(`Cache entry expired: ${key}`);
        });

        this.cache.on('flush', () => {
            console.debug('Cache flushed');
        });
    }

    /**
     * Invalidates all list-related cache entries
     * @private
     */
    private invalidateListCache(): void {
        const keys = this.cache.keys();
        const listKeys = keys.filter(key => key.startsWith('plugins:'));
        this.cache.del(listKeys);
    }

    /**
     * Handles database errors with proper error transformation
     * @private
     * @param error - Original error
     * @returns Transformed error
     */
    private handleDatabaseError(error: any): Error {
        if (error instanceof mongoose.Error.ValidationError) {
            return new Error(`Validation error: ${error.message}`);
        }
        if (error.code === 11000) {
            return new Error('Duplicate plugin identifier');
        }
        return new Error(`Database error: ${error.message}`);
    }
}

export default PluginRepository;
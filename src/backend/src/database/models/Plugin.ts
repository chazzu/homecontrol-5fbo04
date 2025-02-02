import mongoose from 'mongoose'; // v7.0.0
import semver from 'semver'; // v7.5.0
import { IPlugin, PluginState } from '../../core/interfaces/IPlugin';

/**
 * Validates semantic version format with strict compliance
 * @param version - Version string to validate
 * @returns boolean indicating if version is valid
 */
const validateVersion = (version: string): boolean => {
    return Boolean(semver.valid(version));
};

/**
 * Validates plugin name format for URL safety and uniqueness
 * @param name - Plugin name to validate
 * @returns boolean indicating if name is valid
 */
const validatePluginName = (name: string): boolean => {
    const urlSafeRegex = /^[a-zA-Z0-9-_]+$/;
    const reservedNames = ['system', 'core', 'admin', 'dashboard'];
    return (
        name.length >= 1 &&
        name.length <= 100 &&
        urlSafeRegex.test(name) &&
        !reservedNames.includes(name.toLowerCase())
    );
};

/**
 * Validates plugin configuration object
 * @param config - Configuration object to validate
 * @returns boolean indicating if config is valid
 */
const validateConfig = (config: Record<string, any>): boolean => {
    try {
        // Ensure config is serializable
        JSON.stringify(config);
        // Ensure config size is within limits (100KB)
        const configSize = Buffer.from(JSON.stringify(config)).length;
        return configSize <= 102400; // 100KB in bytes
    } catch {
        return false;
    }
};

/**
 * Enhanced Mongoose schema for plugin data with optimized indexing and validation
 */
const PluginSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: validatePluginName,
            message: 'Invalid plugin name format'
        },
        index: true
    },
    version: {
        type: String,
        required: true,
        validate: {
            validator: validateVersion,
            message: 'Invalid semantic version format'
        },
        index: true
    },
    state: {
        type: String,
        enum: Object.values(PluginState),
        default: PluginState.INACTIVE,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    author: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    config: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
        validate: {
            validator: validateConfig,
            message: 'Invalid configuration format or size'
        }
    },
    dependencies: {
        type: Map,
        of: String,
        default: {},
        validate: {
            validator: (deps: Map<string, string>) => {
                return Array.from(deps.values()).every(version => semver.valid(version));
            },
            message: 'Invalid dependency version format'
        }
    },
    permissions: {
        type: [String],
        default: [],
        validate: {
            validator: (perms: string[]) => {
                const validPermissions = ['read', 'write', 'admin', 'execute'];
                return perms.every(perm => validPermissions.includes(perm));
            },
            message: 'Invalid permission type'
        }
    },
    errorLog: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        message: {
            type: String,
            required: true
        },
        stack: String
    }]
}, {
    timestamps: true,
    versionKey: false,
    strict: true,
    collection: 'plugins',
    minimize: false,
    toJSON: {
        virtuals: true,
        getters: true,
        transform: (doc, ret) => {
            delete ret._id;
            return ret;
        }
    }
});

// Compound indexes for optimized queries
PluginSchema.index({ name: 1, version: 1 }, { unique: true });
PluginSchema.index({ state: 1, updatedAt: -1 });
PluginSchema.index({ 'errorLog.timestamp': -1 });

// Virtual for full plugin identifier
PluginSchema.virtual('fullId').get(function() {
    return `${this.name}@${this.version}`;
});

// Pre-save middleware for validation and sanitization
PluginSchema.pre('save', async function(next) {
    // Ensure errorLog doesn't exceed size limit (keep last 100 entries)
    if (this.errorLog.length > 100) {
        this.errorLog = this.errorLog.slice(-100);
    }
    
    // Validate dependency versions
    if (this.isModified('dependencies')) {
        const deps = this.dependencies as Map<string, string>;
        for (const [name, version] of deps.entries()) {
            if (!semver.valid(version)) {
                throw new Error(`Invalid version for dependency ${name}: ${version}`);
            }
        }
    }
    
    next();
});

// Method to add error log entry with automatic cleanup
PluginSchema.methods.logError = function(message: string, stack?: string) {
    this.errorLog.push({
        timestamp: new Date(),
        message,
        stack
    });
    
    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
        this.errorLog = this.errorLog.slice(-100);
    }
    
    return this.save();
};

// Static method to find compatible plugins
PluginSchema.statics.findCompatible = function(dependency: string, version: string) {
    return this.find({
        dependencies: {
            $elemMatch: {
                name: dependency,
                version: {
                    $satisfies: version
                }
            }
        }
    });
};

// Export the model with full type interface
export const Plugin = mongoose.model<IPlugin & mongoose.Document>('Plugin', PluginSchema);

export default Plugin;
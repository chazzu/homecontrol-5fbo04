import { z } from 'zod'; // v3.0+
import express from 'express'; // v4.18.0
import rateLimit from 'express-rate-limit'; // v6.0.0
import NodeCache from 'node-cache'; // v5.1.2
import { IPlugin, PluginState } from '../../core/interfaces/IPlugin';
import { validatePlugin } from '../../core/utils/validation';

// Initialize caching system for validation results
const validationCache = new NodeCache({
    stdTTL: 300, // 5 minutes cache
    checkperiod: 60,
    maxKeys: 1000
});

// Rate limiter for validation requests
const validationRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many validation requests, please try again later'
});

// Enhanced plugin installation schema with strict validation
const pluginInstallSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/),
    version: z.string().regex(
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
        'Invalid semantic version format'
    ),
    description: z.string().min(10).max(1000).optional(),
    author: z.string().email().optional(),
    config: z.record(z.any()).optional(),
    checksum: z.string().min(32).max(64),
    dependencies: z.array(z.string()).optional(),
    state: z.nativeEnum(PluginState).default(PluginState.INACTIVE)
});

// Enhanced plugin update schema
const pluginUpdateSchema = pluginInstallSchema.extend({
    currentVersion: z.string().regex(
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
    ),
    configChanges: z.record(z.any()).optional()
});

/**
 * Middleware to validate plugin installation requests with enhanced security checks
 */
export const validatePluginInstall = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
): Promise<void> => {
    try {
        const cacheKey = `plugin-install-${req.body.id}-${req.body.version}`;
        const cachedResult = validationCache.get(cacheKey);

        if (cachedResult) {
            if (!cachedResult.isValid) {
                res.status(400).json({
                    error: 'Plugin validation failed',
                    details: cachedResult.errors
                });
                return;
            }
            next();
            return;
        }

        // Validate basic structure
        const validationResult = pluginInstallSchema.safeParse(req.body);
        
        if (!validationResult.success) {
            const errors = validationResult.error.errors.map(err => err.message);
            validationCache.set(cacheKey, { isValid: false, errors });
            res.status(400).json({
                error: 'Plugin validation failed',
                details: errors
            });
            return;
        }

        // Perform deep validation using core validator
        const pluginValidation = await validatePlugin(req.body as IPlugin);
        
        if (!pluginValidation.isValid) {
            validationCache.set(cacheKey, pluginValidation);
            res.status(400).json({
                error: 'Plugin security validation failed',
                details: pluginValidation.errors
            });
            return;
        }

        // Additional security checks
        const securityChecks = {
            hasSystemCalls: /process\.|require\(|eval\(/.test(JSON.stringify(req.body)),
            hasNetworkAccess: /http:|https:|ws:|wss:/.test(JSON.stringify(req.body)),
            hasFileSystem: /fs\.|path\./.test(JSON.stringify(req.body))
        };

        if (Object.values(securityChecks).some(check => check)) {
            const result = {
                isValid: false,
                errors: ['Plugin contains potentially unsafe operations']
            };
            validationCache.set(cacheKey, result);
            res.status(400).json({
                error: 'Security validation failed',
                details: securityChecks
            });
            return;
        }

        validationCache.set(cacheKey, { isValid: true, errors: [] });
        next();
    } catch (error) {
        res.status(500).json({
            error: 'Plugin validation error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Middleware to validate plugin update requests with version comparison
 */
export const validatePluginUpdate = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
): Promise<void> => {
    try {
        const cacheKey = `plugin-update-${req.body.id}-${req.body.version}`;
        const cachedResult = validationCache.get(cacheKey);

        if (cachedResult) {
            if (!cachedResult.isValid) {
                res.status(400).json({
                    error: 'Plugin update validation failed',
                    details: cachedResult.errors
                });
                return;
            }
            next();
            return;
        }

        // Validate update payload
        const validationResult = pluginUpdateSchema.safeParse(req.body);
        
        if (!validationResult.success) {
            const errors = validationResult.error.errors.map(err => err.message);
            validationCache.set(cacheKey, { isValid: false, errors });
            res.status(400).json({
                error: 'Plugin update validation failed',
                details: errors
            });
            return;
        }

        // Version comparison
        const currentParts = req.body.currentVersion.split('.').map(Number);
        const newParts = req.body.version.split('.').map(Number);
        
        const isValidUpgrade = newParts.some((part, index) => {
            if (part > currentParts[index]) return true;
            if (part < currentParts[index]) return false;
            return index === newParts.length - 1;
        });

        if (!isValidUpgrade) {
            const result = {
                isValid: false,
                errors: ['New version must be greater than current version']
            };
            validationCache.set(cacheKey, result);
            res.status(400).json({
                error: 'Invalid version upgrade path',
                details: {
                    current: req.body.currentVersion,
                    new: req.body.version
                }
            });
            return;
        }

        // Validate updated plugin
        const pluginValidation = await validatePlugin(req.body as IPlugin);
        
        if (!pluginValidation.isValid) {
            validationCache.set(cacheKey, pluginValidation);
            res.status(400).json({
                error: 'Plugin update validation failed',
                details: pluginValidation.errors
            });
            return;
        }

        validationCache.set(cacheKey, { isValid: true, errors: [] });
        next();
    } catch (error) {
        res.status(500).json({
            error: 'Plugin update validation error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
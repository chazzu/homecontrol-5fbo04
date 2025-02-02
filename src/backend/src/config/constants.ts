// dotenv v16.0.0 - Load environment variables
import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Validates required environment variables and sets defaults
 * @throws Error if required environment variables are missing
 */
const validateEnvironment = (): void => {
  const requiredVars = ['NODE_ENV'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// Validate environment before setting constants
validateEnvironment();

/**
 * Environment-specific configuration flags
 */
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_TEST: process.env.NODE_ENV === 'test',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development'
} as const;

/**
 * Server configuration constants
 */
export const SERVER = {
  PORT: Number(process.env.PORT) || DEFAULT_PORT,
  HOST: process.env.HOST || DEFAULT_HOST,
  CORS_ORIGIN: process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN
} as const;

/**
 * WebSocket connection configuration
 */
export const WEBSOCKET = {
  RECONNECT_INTERVAL: Number(process.env.WEBSOCKET_RECONNECT_INTERVAL) || DEFAULT_WEBSOCKET_RECONNECT_INTERVAL,
  MAX_RETRIES: Number(process.env.WEBSOCKET_MAX_RETRIES) || DEFAULT_WEBSOCKET_MAX_RETRIES,
  PING_INTERVAL: Number(process.env.WEBSOCKET_PING_INTERVAL) || DEFAULT_WEBSOCKET_PING_INTERVAL
} as const;

/**
 * Security-related constants
 */
export const SECURITY = {
  RATE_LIMIT_WINDOW: Number(process.env.RATE_LIMIT_WINDOW) || DEFAULT_RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  JWT_EXPIRY: Number(process.env.JWT_EXPIRY) || DEFAULT_JWT_EXPIRY
} as const;

/**
 * Logging configuration constants
 */
export const LOGGING = {
  LEVEL: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
  FILE_PATH: process.env.LOG_FILE_PATH || DEFAULT_LOG_FILE
} as const;

// Default values for configuration
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = 'localhost';
const DEFAULT_CORS_ORIGIN = '*';
const DEFAULT_WEBSOCKET_RECONNECT_INTERVAL = 5000; // 5 seconds
const DEFAULT_WEBSOCKET_MAX_RETRIES = 5;
const DEFAULT_WEBSOCKET_PING_INTERVAL = 30000; // 30 seconds
const DEFAULT_RATE_LIMIT_WINDOW = 900000; // 15 minutes
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;
const DEFAULT_JWT_EXPIRY = 86400000; // 24 hours
const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_LOG_FILE = 'app.log';

// Freeze all exported objects to prevent runtime modifications
Object.freeze(ENV);
Object.freeze(SERVER);
Object.freeze(WEBSOCKET);
Object.freeze(SECURITY);
Object.freeze(LOGGING);
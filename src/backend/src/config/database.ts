import mongoose from 'mongoose'; // v7.0.0
import { ENV } from './constants';
import type { ProcessEnv } from '../types/environment';

/**
 * Default database configuration options with production-ready settings
 */
const DEFAULT_DB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10,
  minPoolSize: 2,
  connectTimeoutMS: 10000,
  retryWrites: true,
  w: 'majority',
  readPreference: 'primary',
  debug: process.env.NODE_ENV === 'development'
} as const;

/**
 * Retrieves environment-specific database configuration with enhanced security
 * and performance options based on the current environment.
 */
export const getDatabaseConfig = (): mongoose.ConnectOptions => {
  // Validate required environment variables
  if (!process.env.DATABASE_URL || !process.env.DATABASE_NAME) {
    throw new Error('Missing required database environment variables');
  }

  // Base configuration with environment-specific overrides
  const config: mongoose.ConnectOptions = {
    ...DEFAULT_DB_OPTIONS,
    maxPoolSize: ENV.IS_PRODUCTION ? 50 : 10,
    minPoolSize: ENV.IS_PRODUCTION ? 5 : 2,
    autoIndex: !ENV.IS_PRODUCTION, // Disable auto-indexing in production
    debug: ENV.IS_DEVELOPMENT,
  };

  // Production-specific security configurations
  if (ENV.IS_PRODUCTION) {
    Object.assign(config, {
      ssl: true,
      sslValidate: true,
      retryWrites: true,
      w: 'majority',
      journal: true,
      // Enhanced security for production
      authSource: 'admin',
      maxConnecting: 10,
      maxIdleTimeMS: 45000,
      compressors: ['zlib'],
    });
  }

  // Test environment specific configurations
  if (ENV.IS_TEST) {
    Object.assign(config, {
      maxPoolSize: 5,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 2000,
      socketTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
  }

  return config;
};

/**
 * Initializes database connection with enhanced error handling, retry mechanism,
 * and proper cleanup handlers.
 */
export const initializeDatabase = async (): Promise<void> => {
  const maxRetries = 5;
  let retryCount = 0;
  const retryDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000);

  // Connection monitoring
  mongoose.connection.on('connected', () => {
    console.info('Database connection established successfully');
  });

  mongoose.connection.on('error', (error) => {
    console.error('Database connection error:', error);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('Database connection lost');
  });

  // Cleanup handler for graceful shutdown
  const cleanup = async () => {
    try {
      await mongoose.connection.close();
      console.info('Database connection closed gracefully');
      process.exit(0);
    } catch (error) {
      console.error('Error during database cleanup:', error);
      process.exit(1);
    }
  };

  // Register cleanup handlers
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Connection attempt with retry logic
  const connectWithRetry = async (): Promise<void> => {
    try {
      const dbConfig = getDatabaseConfig();
      const connectionString = `${process.env.DATABASE_URL}/${process.env.DATABASE_NAME}`;
      
      await mongoose.connect(connectionString, dbConfig);
    } catch (error) {
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = retryDelay(retryCount);
        console.warn(`Database connection attempt ${retryCount} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return connectWithRetry();
      }
      throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
    }
  };

  // Set mongoose debug mode for development
  mongoose.set('debug', ENV.IS_DEVELOPMENT);

  // Initialize connection
  await connectWithRetry();
};
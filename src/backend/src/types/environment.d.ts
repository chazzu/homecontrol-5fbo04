// TypeScript declaration file for environment variables
// Version: 1.0.0
// Purpose: Defines type-safe environment variable structure for the application

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * Node environment (development/production/test)
       * @example 'development'
       */
      NODE_ENV: 'development' | 'production' | 'test';

      /**
       * Server port number
       * @example '3000'
       */
      PORT: string;

      /**
       * Server host address
       * @example 'localhost' or '0.0.0.0'
       */
      HOST: string;

      /**
       * Database connection URL
       * @example 'mongodb://localhost:27017'
       */
      DATABASE_URL: string;

      /**
       * Database name
       * @example 'smart_home_dashboard'
       */
      DATABASE_NAME: string;

      /**
       * JWT secret key for token signing
       * @security Sensitive - Must be kept secret
       */
      JWT_SECRET: string;

      /**
       * JWT token expiry duration
       * @example '24h'
       */
      JWT_EXPIRY: string;

      /**
       * CORS allowed origins
       * @example 'http://localhost:5173'
       */
      CORS_ORIGIN: string;

      /**
       * Application logging level
       * @example 'info' | 'debug' | 'error'
       */
      LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';

      /**
       * Log file path for file-based logging
       * @example './logs/app.log'
       */
      LOG_FILE: string;

      /**
       * Rate limiting window in milliseconds
       * @example '900000' (15 minutes)
       */
      RATE_LIMIT_WINDOW: string;

      /**
       * Maximum requests allowed within rate limit window
       * @example '100'
       */
      RATE_LIMIT_MAX_REQUESTS: string;

      /**
       * Home Assistant server URL
       * @example 'http://homeassistant.local:8123'
       */
      HOME_ASSISTANT_URL: string;

      /**
       * Home Assistant long-lived access token
       * @security Sensitive - Must be kept secret
       */
      HOME_ASSISTANT_TOKEN: string;
    }
  }
}

// This export is needed to make this a module
export {};
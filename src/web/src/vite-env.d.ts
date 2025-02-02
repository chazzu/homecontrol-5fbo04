/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables used in the Smart Home Dashboard
 * @version 4.0.0
 */
interface ImportMetaEnv {
  /** Home Assistant server URL for WebSocket connection */
  readonly VITE_HA_URL: string;
  
  /** Home Assistant authentication token for secure API access */
  readonly VITE_HA_TOKEN: string;
  
  /** Backend API base URL for additional services */
  readonly VITE_API_BASE_URL: string;
  
  /** Application mode indicating development or production environment */
  readonly MODE: 'development' | 'production';
  
  /** Development mode flag for enabling development features */
  readonly DEV: boolean;
  
  /** Production mode flag for enabling production optimizations */
  readonly PROD: boolean;
  
  /** Server-side rendering flag for SSR capabilities */
  readonly SSR: boolean;
}

/**
 * Extends ImportMeta interface to include environment variables
 * @see https://vitejs.dev/guide/env-and-mode.html
 */
interface ImportMeta {
  /** Environment variables available at runtime */
  readonly env: ImportMetaEnv;
}
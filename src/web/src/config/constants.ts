/**
 * Global constants and configuration values for the Smart Home Dashboard application
 * @version 1.0.0
 */

import { ThemeMode } from '../types/theme.types';
import { WebSocketConnectionState } from '../types/websocket.types';

/**
 * Application metadata constants
 */
export const APP_NAME = 'Smart Home Dashboard';
export const API_VERSION = '1.0.0';

/**
 * Theme configuration constants
 * Default theme mode is light as specified in technical requirements
 */
export const DEFAULT_THEME = ThemeMode.LIGHT;
export const DEFAULT_LOCALE = 'en';

/**
 * Authentication related constants
 * Token storage and timeout values based on security specifications
 */
export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_TIMEOUT = 30000; // 30 seconds timeout for auth operations

/**
 * WebSocket configuration constants
 * Values derived from technical specifications for optimal performance
 */
export const WS_CONFIG = {
    /** Reconnection interval in milliseconds */
    reconnectInterval: 5000, // 5 seconds between reconnection attempts
    /** Maximum number of reconnection attempts */
    maxRetries: 5,
    /** Message timeout in milliseconds */
    messageTimeout: 10000, // 10 seconds timeout for messages
    /** Initial connection state */
    initialState: WebSocketConnectionState.DISCONNECTED
} as const;

/**
 * LocalStorage keys for persistent data
 * Defined based on storage management requirements
 */
export const STORAGE_KEYS = {
    theme: 'theme',
    floorPlans: 'floor_plans',
    entityPlacements: 'entity_placements',
    pluginData: 'plugin_data',
    entityStates: 'entity_states'
} as const;

/**
 * Storage size limits in bytes
 * Based on technical specifications for data models
 */
export const STORAGE_LIMITS = {
    floorPlans: 2 * 1024 * 1024,      // 2MB per floor plan
    entityPlacements: 500 * 1024,      // 500KB for placements
    pluginData: 1024 * 1024,          // 1MB for plugin data
    entityStates: 1024 * 1024         // 1MB for entity states
} as const;

/**
 * UI interaction constants
 * Defined based on UX requirements and technical specifications
 */
export const UI_CONSTANTS = {
    /** Minimum zoom level for floor plan view */
    minZoom: 0.5,
    /** Maximum zoom level for floor plan view */
    maxZoom: 2.0,
    /** Long press delay in milliseconds */
    longPressDelay: 500,
    /** Drag threshold in pixels */
    dragThreshold: 5
} as const;

/**
 * Performance thresholds
 * Based on technical specifications for system performance
 */
export const PERFORMANCE_THRESHOLDS = {
    /** Maximum acceptable UI response time in milliseconds */
    maxResponseTime: 100,
    /** Maximum acceptable state sync latency in milliseconds */
    maxSyncLatency: 200,
    /** Maximum time to restore configuration in milliseconds */
    maxRestoreTime: 1000
} as const;

/**
 * Error codes for system monitoring
 * Aligned with technical specifications for error handling
 */
export const ERROR_CODES = {
    AUTH: {
        INVALID_TOKEN: 'AUTH_001',
        TOKEN_EXPIRED: 'AUTH_002'
    },
    WEBSOCKET: {
        CONNECTION_LOST: 'CONN_001',
        MESSAGE_TIMEOUT: 'CONN_002'
    },
    STORAGE: {
        QUOTA_EXCEEDED: 'STOR_001',
        INVALID_DATA: 'STOR_002'
    }
} as const;
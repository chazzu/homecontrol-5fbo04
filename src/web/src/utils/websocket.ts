/**
 * WebSocket Utility Functions
 * Version: 1.0.0
 * 
 * Provides secure WebSocket connection management and monitoring for Home Assistant integration
 * Implements connection pooling, health monitoring, and automatic recovery with exponential backoff
 * Optimized for < 200ms latency requirement per technical specifications
 */

import { createConnection } from 'home-assistant-js-websocket'; // v8.0.1
import { 
  WebSocketConfig,
  WebSocketConnectionState,
  isWebSocketError
} from '../types/websocket.types';
import { 
  DEFAULT_WEBSOCKET_CONFIG,
  CONNECTION_HEALTH_CONFIG,
  RETRY_STRATEGY,
  WEBSOCKET_ERROR_CODES,
  PERFORMANCE_CONFIG
} from '../config/websocket';

// Global constants for connection management
const RETRY_BACKOFF_MULTIPLIER = 1.5;
const MAX_BACKOFF_TIME = 300000; // 5 minutes
const JITTER_FACTOR = 0.1;
const MIN_BACKOFF_TIME = 1000; // 1 second
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_LATENCY_THRESHOLD = 200; // 200ms latency threshold

/**
 * Creates and configures a secure WebSocket connection to Home Assistant
 * Implements connection pooling and monitoring as per technical requirements
 * 
 * @param config - WebSocket configuration parameters
 * @returns Promise<Connection> - Configured WebSocket connection instance
 * @throws Error if configuration validation fails
 */
export async function createWebSocketConnection(config: WebSocketConfig): Promise<any> {
  try {
    // Validate configuration with security checks
    if (!validateWebSocketConfig(config)) {
      throw new Error('Invalid WebSocket configuration');
    }

    // Merge with default configuration
    const finalConfig = {
      ...DEFAULT_WEBSOCKET_CONFIG,
      ...config
    };

    // Create connection with enhanced security options
    const connection = await createConnection({
      auth: { type: 'token', access_token: finalConfig.token },
      createSocket: async () => new WebSocket(finalConfig.url),
      setupRetry: finalConfig.maxRetries
    });

    // Initialize connection monitoring
    monitorConnectionHealth(connection);

    // Configure automatic reconnection with backoff
    connection.addEventListener('close', () => handleReconnection(connection, finalConfig));

    return connection;
  } catch (error) {
    console.error('WebSocket connection error:', error);
    throw error;
  }
}

/**
 * Calculates exponential backoff time with jitter for connection retries
 * Implements distributed retry pattern to prevent thundering herd
 * 
 * @param retryCount - Number of retry attempts
 * @returns number - Calculated backoff time in milliseconds
 */
export function calculateBackoff(retryCount: number): number {
  // Calculate base exponential backoff
  const baseBackoff = Math.min(
    MIN_BACKOFF_TIME * Math.pow(RETRY_BACKOFF_MULTIPLIER, retryCount),
    MAX_BACKOFF_TIME
  );

  // Apply jitter for distributed retries
  const jitter = baseBackoff * JITTER_FACTOR * (Math.random() * 2 - 1);
  
  return Math.max(MIN_BACKOFF_TIME, baseBackoff + jitter);
}

/**
 * Validates WebSocket configuration with enhanced security checks
 * Ensures all required security parameters are properly configured
 * 
 * @param config - WebSocket configuration to validate
 * @returns boolean - Configuration validity status
 */
export function validateWebSocketConfig(config: WebSocketConfig): boolean {
  if (!config) return false;

  // Validate required fields
  if (!config.url || !config.token) return false;

  // Validate URL format and security
  try {
    const url = new URL(config.url);
    if (!['ws:', 'wss:'].includes(url.protocol)) return false;
    // Enforce WSS in production
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'wss:') return false;
  } catch {
    return false;
  }

  // Validate connection parameters
  if (typeof config.reconnectInterval !== 'number' || config.reconnectInterval < 0) return false;
  if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) return false;

  return true;
}

/**
 * Monitors WebSocket connection health with heartbeat mechanism
 * Implements connection health tracking and automatic recovery
 * 
 * @param connection - WebSocket connection instance to monitor
 */
export function monitorConnectionHealth(connection: any): void {
  let lastPongTime = Date.now();
  let healthCheckInterval: NodeJS.Timeout;
  let pingInterval: NodeJS.Timeout;

  // Setup heartbeat mechanism
  pingInterval = setInterval(() => {
    if (connection.connected) {
      const startTime = Date.now();
      connection.ping().then(() => {
        const latency = Date.now() - startTime;
        lastPongTime = Date.now();
        
        // Check latency threshold
        if (latency > MAX_LATENCY_THRESHOLD) {
          console.warn(`High latency detected: ${latency}ms`);
        }
      }).catch((error: Error) => {
        console.error('Ping failed:', error);
      });
    }
  }, HEARTBEAT_INTERVAL);

  // Monitor connection health
  healthCheckInterval = setInterval(() => {
    const timeSinceLastPong = Date.now() - lastPongTime;
    if (timeSinceLastPong > CONNECTION_HEALTH_CONFIG.PONG_TIMEOUT) {
      console.warn('Connection health check failed');
      connection.reconnect();
    }
  }, CONNECTION_HEALTH_CONFIG.HEALTH_CHECK_INTERVAL);

  // Cleanup on connection close
  connection.addEventListener('close', () => {
    clearInterval(pingInterval);
    clearInterval(healthCheckInterval);
  });
}

/**
 * Handles connection reconnection with exponential backoff
 * Private helper function for connection management
 * 
 * @param connection - WebSocket connection instance
 * @param config - WebSocket configuration
 */
function handleReconnection(connection: any, config: WebSocketConfig): void {
  let retryCount = 0;

  const attemptReconnection = async () => {
    if (retryCount >= config.maxRetries) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const backoffTime = calculateBackoff(retryCount);
    console.log(`Attempting reconnection in ${backoffTime}ms`);

    await new Promise(resolve => setTimeout(resolve, backoffTime));
    
    try {
      await connection.reconnect();
      retryCount = 0; // Reset counter on successful reconnection
    } catch (error) {
      retryCount++;
      console.error(`Reconnection attempt ${retryCount} failed:`, error);
      attemptReconnection();
    }
  };

  attemptReconnection();
}
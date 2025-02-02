import { jest } from '@jest/globals';
import { 
  WebSocketConfig, 
  WebSocketConnectionState 
} from '../../src/types/websocket.types';

// Constants for mock configuration
const MOCK_CONNECTION_DELAY = 100; // Simulated connection delay in ms
const MOCK_MESSAGE_DELAY = 50; // Simulated message delay in ms
const MOCK_DEFAULT_RESPONSE = { success: true, result: {} };
const MOCK_ERROR_RESPONSE = { success: false, error: "Mock error" };

/**
 * Default mock WebSocket configuration
 * @version 1.0.0
 */
export const mockWebSocketConfig: WebSocketConfig = {
  url: 'wss://test.home-assistant.io/api/websocket',
  token: 'mock_access_token',
  reconnectInterval: 1000,
  maxRetries: 3
};

/**
 * Comprehensive mock WebSocket service for testing
 * Simulates Home Assistant WebSocket communication with configurable behavior
 * @version 1.0.0
 */
export class MockWebSocketService {
  private connectionState: WebSocketConnectionState;
  private eventSubscriptions: Map<string, Function[]>;
  private mockResponses: Map<string, any>;
  private connectionDelay: number;
  private retryCount: number;
  private messageIdCounter: number;
  private connectionCallbacks: Set<Function>;

  constructor(private config: WebSocketConfig) {
    this.connectionState = WebSocketConnectionState.DISCONNECTED;
    this.eventSubscriptions = new Map();
    this.mockResponses = new Map();
    this.connectionDelay = MOCK_CONNECTION_DELAY;
    this.retryCount = 0;
    this.messageIdCounter = 1;
    this.connectionCallbacks = new Set();
  }

  /**
   * Simulates WebSocket connection with configurable delay
   * @returns Promise that resolves when mock connection is established
   */
  public async connect(): Promise<void> {
    this.connectionState = WebSocketConnectionState.CONNECTING;

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.retryCount >= this.config.maxRetries) {
          this.connectionState = WebSocketConnectionState.DISCONNECTED;
          reject(new Error('Max retry attempts reached'));
          return;
        }

        if (Math.random() > 0.9) { // 10% chance of connection failure
          this.retryCount++;
          reject(new Error('Random connection failure'));
          return;
        }

        this.connectionState = WebSocketConnectionState.CONNECTED;
        this.retryCount = 0;
        this.connectionCallbacks.forEach(callback => callback());
        resolve();
      }, this.connectionDelay);
    });
  }

  /**
   * Simulates WebSocket disconnection
   */
  public disconnect(): void {
    this.connectionState = WebSocketConnectionState.DISCONNECTED;
    this.eventSubscriptions.clear();
    this.mockResponses.clear();
    this.retryCount = 0;
    this.messageIdCounter = 1;
  }

  /**
   * Simulates event subscription with callback management
   * @param eventType - Type of event to subscribe to
   * @param callback - Callback function for event handling
   * @returns Unsubscribe function
   */
  public subscribe(eventType: string, callback: Function): Function {
    if (!this.eventSubscriptions.has(eventType)) {
      this.eventSubscriptions.set(eventType, []);
    }

    const callbacks = this.eventSubscriptions.get(eventType)!;
    callbacks.push(callback);

    return () => {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Simulates sending WebSocket message with response handling
   * @param message - Message to send
   * @returns Promise that resolves with mock response
   */
  public async sendMessage(message: any): Promise<any> {
    if (this.connectionState !== WebSocketConnectionState.CONNECTED) {
      throw new Error('Not connected');
    }

    const messageId = this.messageIdCounter++;
    const enhancedMessage = { ...message, id: messageId };

    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse = this.mockResponses.get(message.type) || MOCK_DEFAULT_RESPONSE;
        resolve({
          ...mockResponse,
          id: messageId
        });
      }, MOCK_MESSAGE_DELAY);
    });
  }

  /**
   * Returns current mock connection state
   */
  public getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  /**
   * Configures mock response for specific message type
   * @param messageType - Type of message to mock
   * @param response - Mock response to return
   */
  public setMockResponse(messageType: string, response: any): void {
    this.mockResponses.set(messageType, response);
  }

  /**
   * Simulates WebSocket error scenario
   * @param error - Error to simulate
   */
  public simulateError(error: Error): void {
    this.connectionState = WebSocketConnectionState.DISCONNECTED;
    this.eventSubscriptions.forEach(callbacks => {
      callbacks.forEach(callback => callback({ type: 'error', error }));
    });
  }

  /**
   * Registers connection state change callback
   * @param callback - Callback function for connection state changes
   */
  public onConnectionChange(callback: Function): void {
    this.connectionCallbacks.add(callback);
  }

  /**
   * Simulates incoming WebSocket event
   * @param eventType - Type of event to simulate
   * @param data - Event data
   */
  public simulateEvent(eventType: string, data: any): void {
    if (this.connectionState !== WebSocketConnectionState.CONNECTED) {
      return;
    }

    const callbacks = this.eventSubscriptions.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Sets simulated connection delay
   * @param delay - Delay in milliseconds
   */
  public setConnectionDelay(delay: number): void {
    this.connectionDelay = delay;
  }

  /**
   * Resets mock service to initial state
   */
  public reset(): void {
    this.disconnect();
    this.connectionCallbacks.clear();
    this.mockResponses.clear();
  }
}
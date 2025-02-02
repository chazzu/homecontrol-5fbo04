/**
 * @file Global Test Setup Configuration
 * @version 1.0.0
 * 
 * Configures Jest testing environment with DOM utilities, browser API mocks,
 * and WebSocket communication simulation for the Smart Home Dashboard.
 */

import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { mockWebSocketService } from './mocks/websocket';
import { mockEntityStates } from './mocks/entities';

/**
 * Configure Jest DOM environment and extend expect with DOM matchers
 */
export function setupJestDom(): void {
  // Extend Jest matchers with DOM-specific assertions
  expect.extend({
    toHaveEntityState(received: HTMLElement, entityId: string, expectedState: string) {
      const state = received.getAttribute('data-entity-state');
      const pass = state === expectedState;
      return {
        message: () =>
          `expected element to have entity ${entityId} in state ${expectedState} but got ${state}`,
        pass,
      };
    },
    toHaveEntityAttribute(received: HTMLElement, attribute: string, value: unknown) {
      const attributeValue = received.getAttribute(`data-entity-${attribute}`);
      const pass = attributeValue === String(value);
      return {
        message: () =>
          `expected element to have entity attribute ${attribute}=${value} but got ${attributeValue}`,
        pass,
      };
    }
  });

  // Configure automatic cleanup after each test
  afterEach(() => {
    document.body.innerHTML = '';
  });
}

/**
 * Setup comprehensive mock implementations for browser APIs
 */
export function setupMockBrowserAPIs(): void {
  // Mock ResizeObserver
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    error: jest.fn()
  }));

  // Mock matchMedia
  global.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    error: jest.fn()
  }));

  // Mock localStorage with quota error simulation
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn().mockImplementation((key: string, value: string) => {
      if (value.length > 5242880) { // 5MB limit
        throw new Error('QuotaExceededError');
      }
    }),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
    error: jest.fn()
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock performance API
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    timeOrigin: Date.now(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    getEntries: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    toJSON: jest.fn()
  };

  // Reset all mocks between tests
  afterEach(() => {
    jest.clearAllMocks();
  });
}

/**
 * Configure WebSocket mocks with realistic timing simulation
 */
export function setupWebSocketMocks(): void {
  const ws = mockWebSocketService;

  // Configure default latency simulation
  ws.setConnectionDelay(100); // 100ms connection delay

  // Setup initial mock entity states
  Object.entries(mockEntityStates).forEach(([entityId, state]) => {
    ws.simulateEvent('state_changed', {
      data: {
        entity_id: entityId,
        new_state: state,
        old_state: null
      }
    });
  });

  // Configure error scenarios
  const errorScenarios = {
    connectionError: new Error('Connection failed'),
    authError: new Error('Authentication failed'),
    timeoutError: new Error('Request timeout')
  };

  // Reset WebSocket mock between tests
  afterEach(() => {
    ws.reset();
  });

  // Cleanup all subscriptions after tests
  afterAll(() => {
    ws.disconnect();
  });
}

// Initialize all test environment configurations
setupJestDom();
setupMockBrowserAPIs();
setupWebSocketMocks();
import { WebSocketConnectionState } from '../../../types/websocket.types';
import React from 'react';

/**
 * Props interface for the ConnectionStatus component
 * Defines the required and optional properties for component instantiation
 */
export interface ConnectionStatusProps {
  /** Current WebSocket connection state */
  state: WebSocketConnectionState;
  /** Callback function to retry connection on failure */
  onRetry: () => void;
  /** Optional CSS class name for custom styling */
  className?: string;
}

/**
 * Props interface for styled-components that depend on connection state
 * Used for dynamic styling based on the current connection state
 */
export interface ConnectionStatusStyleProps {
  /** Current WebSocket connection state for style computation */
  state: WebSocketConnectionState;
}

/**
 * Type mapping connection states to theme colors
 * Provides consistent color feedback for different connection states
 */
export type ConnectionStatusColors = Record<WebSocketConnectionState, string>;

/**
 * Type mapping connection states to display text
 * Provides user-friendly status messages for each connection state
 */
export type ConnectionStatusText = Record<WebSocketConnectionState, string>;
import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import debounce from 'lodash/debounce';
import { ConnectionStatusProps } from './ConnectionStatus.types';
import Icon from '../../common/Icon/Icon';
import { IconType, IconSize } from '../../common/Icon/Icon.types';
import { WebSocketConnectionState } from '../../../types/websocket.types';

// Theme-aware color mapping for connection states
const CONNECTION_STATUS_COLORS = {
  [WebSocketConnectionState.CONNECTED]: 'theme.colors.success',
  [WebSocketConnectionState.CONNECTING]: 'theme.colors.warning',
  [WebSocketConnectionState.DISCONNECTED]: 'theme.colors.error',
  [WebSocketConnectionState.RECONNECTING]: 'theme.colors.warning',
  [WebSocketConnectionState.ERROR]: 'theme.colors.error',
} as const;

// User-friendly status messages
const CONNECTION_STATUS_TEXT = {
  [WebSocketConnectionState.CONNECTED]: 'Connected',
  [WebSocketConnectionState.CONNECTING]: 'Connecting...',
  [WebSocketConnectionState.DISCONNECTED]: 'Disconnected',
  [WebSocketConnectionState.RECONNECTING]: 'Reconnecting...',
  [WebSocketConnectionState.ERROR]: 'Connection Error',
} as const;

// Debounce delay for retry attempts (ms)
const RETRY_DELAY = 500;

// Styled components with theme integration
const StyledContainer = styled.div<{ $state: WebSocketConnectionState }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: ${({ theme, $state }) => theme.colors.background};
  border: 1px solid ${({ theme, $state }) => theme.colors[CONNECTION_STATUS_COLORS[$state]]};
  cursor: ${({ $state }) => 
    ($state === WebSocketConnectionState.DISCONNECTED || 
     $state === WebSocketConnectionState.ERROR) ? 'pointer' : 'default'
  };
  transition: all 0.2s ease-in-out;

  &:hover {
    opacity: ${({ $state }) => 
      ($state === WebSocketConnectionState.DISCONNECTED || 
       $state === WebSocketConnectionState.ERROR) ? 0.8 : 1
    };
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focusRing};
    outline-offset: 2px;
  }
`;

const StyledText = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
`;

const StyledLatency = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-left: 4px;
`;

/**
 * Get appropriate icon and accessibility label based on connection state
 */
const getStatusIcon = (state: WebSocketConnectionState) => {
  const iconMap = {
    [WebSocketConnectionState.CONNECTED]: {
      name: 'check-circle',
      ariaLabel: 'Connection established'
    },
    [WebSocketConnectionState.CONNECTING]: {
      name: 'loading',
      ariaLabel: 'Establishing connection'
    },
    [WebSocketConnectionState.DISCONNECTED]: {
      name: 'disconnect',
      ariaLabel: 'Connection lost'
    },
    [WebSocketConnectionState.RECONNECTING]: {
      name: 'refresh',
      ariaLabel: 'Attempting to reconnect'
    },
    [WebSocketConnectionState.ERROR]: {
      name: 'error',
      ariaLabel: 'Connection error occurred'
    },
  };

  return iconMap[state];
};

/**
 * ConnectionStatus component displays real-time WebSocket connection status
 * with visual feedback and retry functionality
 */
const ConnectionStatus: React.FC<ConnectionStatusProps> = React.memo(({
  state,
  onRetry,
  className,
  latency
}) => {
  // Create debounced retry handler
  const debouncedRetry = useMemo(
    () => debounce(onRetry, RETRY_DELAY, { leading: true, trailing: false }),
    [onRetry]
  );

  // Handle click events with retry functionality
  const handleClick = useCallback(() => {
    if (state === WebSocketConnectionState.DISCONNECTED || 
        state === WebSocketConnectionState.ERROR) {
      debouncedRetry();
      console.log('[ConnectionStatus] Retry attempt initiated');
    }
  }, [state, debouncedRetry]);

  // Get status icon configuration
  const statusIcon = getStatusIcon(state);

  // Clean up debounced function on unmount
  React.useEffect(() => {
    return () => {
      debouncedRetry.cancel();
    };
  }, [debouncedRetry]);

  return (
    <StyledContainer
      $state={state}
      className={className}
      onClick={handleClick}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={state === WebSocketConnectionState.DISCONNECTED || 
                state === WebSocketConnectionState.ERROR ? 0 : -1}
      data-testid="connection-status"
    >
      <Icon
        type={IconType.STATUS}
        name={statusIcon.name}
        size={IconSize.SMALL}
        color={CONNECTION_STATUS_COLORS[state]}
        ariaLabel={statusIcon.ariaLabel}
      />
      <StyledText>
        {CONNECTION_STATUS_TEXT[state]}
        {state === WebSocketConnectionState.CONNECTED && latency && (
          <StyledLatency>({latency}ms)</StyledLatency>
        )}
      </StyledText>
    </StyledContainer>
  );
});

ConnectionStatus.displayName = 'ConnectionStatus';

export default ConnectionStatus;
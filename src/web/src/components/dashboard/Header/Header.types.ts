import { ReactNode } from 'react'; // v18.0.0
import { WebSocketConnectionState } from '../../../types/websocket.types';
import { UserRole } from '../../../types/auth.types';

/**
 * Interface defining the structure of floor plan selection options.
 * Used for populating and managing floor plan dropdown selections.
 */
export interface FloorOption {
    /** Unique identifier for the floor plan */
    id: string;
    
    /** Display name of the floor plan */
    name: string;
    
    /** Numerical order for display sorting */
    order: number;
}

/**
 * Interface defining the props for the Header component.
 * Contains all required properties for header functionality including
 * connection status, user role, and event handlers.
 */
export interface HeaderProps {
    /** Current WebSocket connection state for status display */
    connectionState: WebSocketConnectionState;
    
    /** Current user's role for conditional rendering of controls */
    userRole: UserRole;
    
    /**
     * Callback function triggered when floor plan selection changes
     * @param floorId - ID of the selected floor plan
     */
    onFloorChange: (floorId: string) => void;
    
    /**
     * Callback function triggered when settings button is clicked
     * Opens settings dialog/menu
     */
    onSettingsClick: () => void;
    
    /**
     * Optional CSS class name for custom styling
     * Allows for component customization through styled-components or CSS modules
     */
    className?: string;
    
    /**
     * Optional list of available floor plans
     * Used to populate floor plan selector dropdown
     */
    floors?: FloorOption[];
    
    /**
     * Optional currently selected floor ID
     * Used to highlight current selection in floor plan dropdown
     */
    selectedFloorId?: string;
    
    /**
     * Optional custom header title
     * Defaults to "Smart Home Dashboard" if not provided
     */
    title?: string;
    
    /**
     * Optional custom header content
     * Allows for injection of additional components in the header
     */
    children?: ReactNode;
}
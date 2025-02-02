import { Express } from 'express'; // ^4.18.0

declare global {
  namespace Express {
    /**
     * Extended Express Request interface with custom properties for
     * authentication, Home Assistant integration, and floor plan management
     */
    interface Request {
      /**
       * Authenticated user information
       */
      user: {
        /** Unique user identifier */
        id: string;
        /** Authentication token */
        token: string;
        /** User permissions array */
        permissions: string[];
        /** User role - determines access level */
        role: "admin" | "user" | "guest";
        /** Session-specific data */
        sessionData: {
          /** Last access timestamp */
          lastAccess: Date;
          /** Client IP address */
          ipAddress: string;
        };
        /** User preferences */
        preferences: {
          /** UI theme selection */
          theme: string;
          /** Interface language */
          language: string;
        };
      };

      /**
       * Home Assistant integration data
       */
      homeAssistant: {
        /** Home Assistant access token */
        token: string;
        /** WebSocket connection identifier */
        connectionId: string;
        /** Entity identifier */
        entityId: string;
        /** Current entity state */
        state: any;
        /** Entity attributes */
        attributes: Record<string, unknown>;
        /** Last state update timestamp */
        lastUpdate: Date;
        /** WebSocket connection status */
        wsConnection: {
          /** Connection state */
          connected: boolean;
          /** Last ping timestamp */
          lastPing: Date;
        };
      };

      /**
       * Floor plan management data
       */
      floorPlan: {
        /** Floor plan identifier */
        id: string;
        /** Floor plan name */
        name: string;
        /** SVG data for the floor plan */
        data: string;
        /** Floor plan dimensions */
        dimensions: {
          width: number;
          height: number;
        };
        /** Floor plan scale (pixels per meter) */
        scale: number;
        /** Placed entities on the floor plan */
        entities: Array<{
          id: string;
          position: {
            x: number;
            y: number;
          };
        }>;
        /** Additional metadata */
        metadata: Record<string, unknown>;
      };
    }

    /**
     * Extended Express Response interface with custom properties for
     * error handling and success responses
     */
    interface Response {
      /**
       * Error response structure
       */
      error: {
        /** Error code identifier */
        code: string;
        /** Error message */
        message: string;
        /** Additional error details */
        details: any;
        /** Error timestamp */
        timestamp: Date;
        /** Request identifier for tracking */
        requestId: string;
        /** Optional stack trace */
        stack?: string;
      };

      /**
       * Success response structure
       */
      success: {
        /** Response payload */
        data: unknown;
        /** Additional metadata */
        metadata: Record<string, unknown>;
      };
    }
  }
}

/**
 * Type for requests requiring authentication
 */
export type AuthenticatedRequest = Express.Request & {
  user: {
    id: string;
    token: string;
    permissions: string[];
    role: "admin" | "user" | "guest";
  };
};

/**
 * Type for requests involving Home Assistant operations
 */
export type HomeAssistantRequest = Express.Request & {
  homeAssistant: {
    token: string;
    entityId: string;
    state: any;
    attributes: Record<string, unknown>;
  };
};

/**
 * Type for requests involving floor plan operations
 */
export type FloorPlanRequest = Express.Request & {
  floorPlan: {
    id: string;
    name: string;
    data: string;
    entities: Array<{
      id: string;
      position: {
        x: number;
        y: number;
      };
    }>;
  };
};

/**
 * Type for standardized error responses
 */
export type ErrorResponse = {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId: string;
};
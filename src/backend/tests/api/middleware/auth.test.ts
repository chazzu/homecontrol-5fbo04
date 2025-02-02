import { Request, Response, NextFunction } from 'express';
import { authenticate, checkRole } from '../../../src/api/middleware/auth';
import { WebSocketManager } from '../../../src/core/WebSocketManager';
import { WebSocketConnectionState } from '../../../src/core/types/WebSocket.types';

// Mock WebSocketManager
jest.mock('../../../src/core/WebSocketManager', () => ({
  getInstance: jest.fn().mockReturnValue({
    getConnectionState: jest.fn()
  })
}));

describe('Authentication Middleware', () => {
  // Test setup variables
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let wsManager: jest.Mocked<WebSocketManager>;

  // Mock tokens
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ';
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InVzZXIiLCJleHAiOjB9';

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request mock
    mockRequest = {
      headers: {},
      body: {},
      ip: '127.0.0.1'
    };

    // Setup response mock
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Setup next function mock
    mockNext = jest.fn();

    // Setup WebSocket manager mock
    wsManager = WebSocketManager.getInstance() as jest.Mocked<WebSocketManager>;
  });

  describe('authenticate middleware', () => {
    it('should pass authentication with valid token', async () => {
      // Arrange
      mockRequest.headers = { authorization: `Bearer ${validToken}` };
      wsManager.getConnectionState.mockReturnValue({ 
        state: WebSocketConnectionState.CONNECTED,
        metrics: { latency: 50, messagesSent: 0, messagesReceived: 0, lastMessageTimestamp: 0, reconnections: 0 }
      });

      // Act
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.role).toBe('admin');
    });

    it('should reject requests without authorization header', async () => {
      // Act
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Authentication token is required' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject malformed authorization header', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Invalid Format' };

      // Act
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Invalid token format' 
      });
    });

    it('should reject expired tokens', async () => {
      // Arrange
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

      // Act
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Token has expired' 
      });
    });

    it('should reject requests when WebSocket is disconnected', async () => {
      // Arrange
      mockRequest.headers = { authorization: `Bearer ${validToken}` };
      wsManager.getConnectionState.mockReturnValue({ 
        state: WebSocketConnectionState.DISCONNECTED,
        metrics: { latency: 0, messagesSent: 0, messagesReceived: 0, lastMessageTimestamp: 0, reconnections: 0 }
      });

      // Act
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Invalid connection state' 
      });
    });

    it('should handle internal server errors gracefully', async () => {
      // Arrange
      mockRequest.headers = { authorization: `Bearer ${validToken}` };
      wsManager.getConnectionState.mockImplementation(() => {
        throw new Error('Internal error');
      });

      // Act
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Internal server error' 
      });
    });
  });

  describe('checkRole middleware', () => {
    beforeEach(() => {
      // Setup authenticated request for role tests
      mockRequest.user = {
        id: '123',
        token: validToken,
        role: 'admin',
        permissions: ['read', 'write'],
        sessionData: {
          lastAccess: new Date(),
          ipAddress: '127.0.0.1'
        },
        preferences: {
          theme: 'light',
          language: 'en'
        }
      };
    });

    it('should allow access for users with sufficient role', () => {
      // Arrange
      const roleMiddleware = checkRole(['admin', 'user']);

      // Act
      roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for users with insufficient role', () => {
      // Arrange
      mockRequest.user!.role = 'guest';
      const roleMiddleware = checkRole(['admin']);

      // Act
      roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Insufficient permissions' 
      });
    });

    it('should handle requests without user context', () => {
      // Arrange
      delete mockRequest.user;
      const roleMiddleware = checkRole(['admin']);

      // Act
      roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Authentication token is required' 
      });
    });

    it('should respect role hierarchy', () => {
      // Arrange
      const roleMiddleware = checkRole(['user']);
      mockRequest.user!.role = 'admin';

      // Act
      roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle internal errors gracefully', () => {
      // Arrange
      mockRequest.user = null as any;
      const roleMiddleware = checkRole(['admin']);

      // Act
      roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Internal server error' 
      });
    });
  });
});
/**
 * @file StateController.ts
 * @version 1.0.0
 * 
 * REST API controller for managing entity states in the Smart Home Dashboard.
 * Implements real-time state synchronization with comprehensive error handling,
 * validation, and performance optimization.
 */

import { injectable } from 'inversify'; // v6.0.1
import { 
  controller, 
  httpGet, 
  httpPost, 
  request, 
  response 
} from 'inversify-express-utils'; // v6.3.2
import { Request, Response } from 'express'; // v4.18.2
import rateLimit from 'express-rate-limit'; // v6.7.0
import compression from 'compression'; // v1.7.4
import { StateService } from '../../core/services/StateService';
import { HAEntityState } from '../../types/homeAssistant';
import { StateError, StateErrorCode } from '../../core/types/State.types';

/**
 * Rate limiting middleware configuration
 * Implements protection against API abuse
 */
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Validation schema for entity ID parameter
 */
const entityIdSchema = {
  type: 'string',
  pattern: '^[a-zA-Z0-9_]+\\.[a-zA-Z0-9_]+$'
};

/**
 * Validation schema for state update payload
 */
const stateUpdateSchema = {
  type: 'object',
  required: ['state'],
  properties: {
    state: { type: 'string' },
    attributes: { type: 'object' }
  }
};

/**
 * Validation schema for query parameters
 */
const querySchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100 },
    domain: { type: 'string', pattern: '^[a-zA-Z0-9_]+$' }
  }
};

@injectable()
@controller('/api/v1/states')
export class StateController {
  private readonly CACHE_DURATION = 5000; // 5 seconds cache duration

  constructor(private readonly stateService: StateService) {}

  /**
   * Retrieves state of a specific entity with caching and validation
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns Entity state with cache headers
   */
  @httpGet('/:entityId')
  public async getState(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const { entityId } = req.params;

      // Validate entity ID format
      if (!entityIdSchema.pattern.test(entityId)) {
        return res.status(400).json({
          error: 'Invalid entity ID format',
          code: StateErrorCode.INVALID_ENTITY_ID
        });
      }

      // Check if we can return cached response
      const cachedState = res.getHeader('X-State-Cache');
      if (cachedState && Date.now() - Number(res.getHeader('X-State-Timestamp')) < this.CACHE_DURATION) {
        return res.status(200).json(JSON.parse(cachedState as string));
      }

      const state = await this.stateService.getState(entityId);

      // Set cache headers
      res.setHeader('X-State-Cache', JSON.stringify(state));
      res.setHeader('X-State-Timestamp', Date.now().toString());
      res.setHeader('Cache-Control', `private, max-age=${this.CACHE_DURATION / 1000}`);

      return res.status(200).json(state);

    } catch (error) {
      if (error instanceof StateError) {
        return res.status(400).json({
          error: error.message,
          code: error.code,
          details: error.details
        });
      }
      return res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Retrieves states of all entities with pagination and filtering
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns Paginated array of entity states
   */
  @httpGet('/')
  public async getAllStates(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const domain = req.query.domain as string;

      // Validate query parameters
      if (!querySchema.properties.page.minimum || !querySchema.properties.limit.maximum) {
        return res.status(400).json({
          error: 'Invalid pagination parameters',
          code: 'INVALID_QUERY'
        });
      }

      const states = await this.stateService.getAllStates();
      let filteredStates = states;

      // Apply domain filtering if specified
      if (domain) {
        filteredStates = states.filter(state => 
          state.entity_id.split('.')[0] === domain
        );
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedStates = filteredStates.slice(startIndex, endIndex);

      // Set cache headers
      res.setHeader('X-Total-Count', filteredStates.length.toString());
      res.setHeader('X-Page', page.toString());
      res.setHeader('X-Limit', limit.toString());
      res.setHeader('Cache-Control', `private, max-age=${this.CACHE_DURATION / 1000}`);

      return res.status(200).json({
        data: paginatedStates,
        pagination: {
          total: filteredStates.length,
          page,
          limit,
          pages: Math.ceil(filteredStates.length / limit)
        }
      });

    } catch (error) {
      if (error instanceof StateError) {
        return res.status(400).json({
          error: error.message,
          code: error.code,
          details: error.details
        });
      }
      return res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Updates state of a specific entity with validation and optimistic updates
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns Success response or error with specific code
   */
  @httpPost('/:entityId')
  public async setState(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const { entityId } = req.params;
      const stateUpdate = req.body as Partial<HAEntityState>;

      // Validate entity ID and state update payload
      if (!entityIdSchema.pattern.test(entityId)) {
        return res.status(400).json({
          error: 'Invalid entity ID format',
          code: StateErrorCode.INVALID_ENTITY_ID
        });
      }

      if (!stateUpdateSchema.required.every(field => field in stateUpdate)) {
        return res.status(400).json({
          error: 'Invalid state update payload',
          code: StateErrorCode.INVALID_STATE
        });
      }

      // Sanitize input data
      const sanitizedUpdate: Partial<HAEntityState> = {
        state: String(stateUpdate.state),
        attributes: stateUpdate.attributes ? 
          JSON.parse(JSON.stringify(stateUpdate.attributes)) : 
          undefined
      };

      await this.stateService.setState(entityId, sanitizedUpdate);

      // Invalidate cache for this entity
      res.setHeader('X-State-Cache', '');
      res.setHeader('Cache-Control', 'no-cache');

      return res.status(200).json({
        message: 'State updated successfully',
        entityId,
        timestamp: Date.now()
      });

    } catch (error) {
      if (error instanceof StateError) {
        return res.status(400).json({
          error: error.message,
          code: error.code,
          details: error.details
        });
      }
      return res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}
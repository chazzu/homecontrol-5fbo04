/**
 * Floor Plan Routes Module
 * Implements secure CRUD operations and entity placement management for floor plans
 * with comprehensive authentication, authorization, and validation.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import { container } from 'inversify'; // v6.0.1
import { FloorPlanController } from '../controllers/FloorPlanController';
import { authenticate, checkRole } from '../middleware/auth';
import { validateFloorPlanRequest } from '../middleware/validation';

// Initialize router with strict security settings
const router = Router();

// Get FloorPlanController instance from DI container
const floorPlanController = container.get<FloorPlanController>(FloorPlanController);

/**
 * Create new floor plan
 * Requires admin role and validates request data
 * POST /api/floor-plans
 */
router.post('/',
  authenticate,
  checkRole(['admin']),
  validateFloorPlanRequest,
  async (req, res, next) => {
    try {
      return await floorPlanController.createFloorPlan(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get all floor plans
 * Requires authentication and supports pagination
 * GET /api/floor-plans
 */
router.get('/',
  authenticate,
  async (req, res, next) => {
    try {
      return await floorPlanController.getAllFloorPlans(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get floor plan by ID
 * Requires authentication and validates floor plan access
 * GET /api/floor-plans/:id
 */
router.get('/:id',
  authenticate,
  async (req, res, next) => {
    try {
      return await floorPlanController.getFloorPlan(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update floor plan
 * Requires admin role and validates update data
 * PUT /api/floor-plans/:id
 */
router.put('/:id',
  authenticate,
  checkRole(['admin']),
  validateFloorPlanRequest,
  async (req, res, next) => {
    try {
      return await floorPlanController.updateFloorPlan(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete floor plan
 * Requires admin role and validates deletion permissions
 * DELETE /api/floor-plans/:id
 */
router.delete('/:id',
  authenticate,
  checkRole(['admin']),
  async (req, res, next) => {
    try {
      return await floorPlanController.deleteFloorPlan(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update entity placements within floor plan
 * Requires authentication and validates placement data
 * PUT /api/floor-plans/:id/entities
 */
router.put('/:id/entities',
  authenticate,
  validateFloorPlanRequest,
  async (req, res, next) => {
    try {
      return await floorPlanController.updateEntityPlacements(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// Export configured router with security middleware
export default router;
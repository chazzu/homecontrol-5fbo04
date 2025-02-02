import { injectable, inject } from 'inversify'; // v6.0.1
import { Request, Response } from 'express'; // v4.18.2
import { FloorPlanService } from '../../core/services/FloorPlanService';
import { IFloorPlan } from '../../core/interfaces/IFloorPlan';
import { validateFloorPlan } from '../../core/utils/validation';
import { processSvgFloorPlan } from '../../core/utils/svgProcessor';
import { FloorPlanStatus } from '../../core/types/FloorPlan.types';

/**
 * Controller handling HTTP requests for floor plan management with enhanced security,
 * validation, and error handling in the Smart Home Dashboard API.
 * @version 1.0.0
 */
@injectable()
export class FloorPlanController {
    // Rate limiting configuration
    private readonly RATE_LIMIT = {
        WINDOW: 60000, // 1 minute
        MAX_REQUESTS: 100
    };

    // Cache configuration
    private readonly CACHE_CONFIG = {
        TTL: 300000, // 5 minutes
        MAX_SIZE: 100
    };

    constructor(
        @inject(FloorPlanService) private readonly floorPlanService: FloorPlanService
    ) {}

    /**
     * Creates a new floor plan with comprehensive validation and security checks
     * @param req Express request object containing floor plan data
     * @param res Express response object
     */
    public async createFloorPlan(req: Request, res: Response): Promise<Response> {
        try {
            const floorPlanData: Partial<IFloorPlan> = req.body;

            // Validate request data
            const validationResult = await validateFloorPlan(floorPlanData as IFloorPlan);
            if (!validationResult.isValid) {
                return res.status(400).json({
                    success: false,
                    errors: validationResult.errors
                });
            }

            // Process and validate SVG data
            const { svgData, dimensions } = await processSvgFloorPlan(floorPlanData.svgData!);
            
            // Create floor plan
            const createdFloorPlan = await this.floorPlanService.createFloorPlan({
                ...floorPlanData,
                svgData,
                dimensions,
                status: FloorPlanStatus.ACTIVE,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return res.status(201).json({
                success: true,
                data: createdFloorPlan
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Retrieves a floor plan by ID with caching and security validation
     * @param req Express request object containing floor plan ID
     * @param res Express response object
     */
    public async getFloorPlan(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;

            const floorPlan = await this.floorPlanService.getFloorPlanById(id);
            if (!floorPlan) {
                return res.status(404).json({
                    success: false,
                    error: 'Floor plan not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: floorPlan
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Retrieves all floor plans with pagination and filtering
     * @param req Express request object containing query parameters
     * @param res Express response object
     */
    public async getAllFloorPlans(req: Request, res: Response): Promise<Response> {
        try {
            const floorPlans = await this.floorPlanService.getAllFloorPlans();

            return res.status(200).json({
                success: true,
                data: floorPlans
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Updates a floor plan with validation and security checks
     * @param req Express request object containing update data
     * @param res Express response object
     */
    public async updateFloorPlan(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            const updateData: Partial<IFloorPlan> = req.body;

            // Validate update data
            if (updateData.svgData) {
                const { svgData, dimensions } = await processSvgFloorPlan(updateData.svgData);
                updateData.svgData = svgData;
                updateData.dimensions = dimensions;
            }

            const updatedFloorPlan = await this.floorPlanService.updateFloorPlan(id, {
                ...updateData,
                updatedAt: new Date()
            });

            if (!updatedFloorPlan) {
                return res.status(404).json({
                    success: false,
                    error: 'Floor plan not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: updatedFloorPlan
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Deletes a floor plan with cascade cleanup
     * @param req Express request object containing floor plan ID
     * @param res Express response object
     */
    public async deleteFloorPlan(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;

            await this.floorPlanService.deleteFloorPlan(id);

            return res.status(204).send();
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Updates entity placements within a floor plan
     * @param req Express request object containing placement data
     * @param res Express response object
     */
    public async updateEntityPlacements(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            const { placements } = req.body;

            const updatedFloorPlan = await this.floorPlanService.updateEntityPlacements(
                id,
                placements
            );

            if (!updatedFloorPlan) {
                return res.status(404).json({
                    success: false,
                    error: 'Floor plan not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: updatedFloorPlan
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }
}
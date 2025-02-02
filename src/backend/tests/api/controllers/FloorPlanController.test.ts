import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3
import MockDate from 'mockdate'; // ^3.0.5
import { FloorPlanController } from '../../../src/api/controllers/FloorPlanController';
import { FloorPlanService } from '../../../src/core/services/FloorPlanService';
import { IFloorPlan } from '../../../src/core/interfaces/IFloorPlan';
import { FloorPlanStatus } from '../../../src/core/types/FloorPlan.types';

// Mock the FloorPlanService
jest.mock('../../../src/core/services/FloorPlanService');

// Test constants
const TEST_CONSTANTS = {
    PERFORMANCE_THRESHOLD: 100, // 100ms performance threshold
    MOCK_DATE: '2024-01-01T00:00:00.000Z',
    VALID_SVG: '<svg width="100" height="100"></svg>',
    MAX_SVG_SIZE: 5 * 1024 * 1024 // 5MB
};

// Mock floor plan data
const mockFloorPlan: IFloorPlan = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Floor Plan',
    svgData: TEST_CONSTANTS.VALID_SVG,
    dimensions: { width: 100, height: 100 },
    scale: 1,
    order: 0,
    entityPlacements: [],
    createdAt: new Date(TEST_CONSTANTS.MOCK_DATE),
    updatedAt: new Date(TEST_CONSTANTS.MOCK_DATE)
};

describe('FloorPlanController', () => {
    let controller: FloorPlanController;
    let mockFloorPlanService: jest.Mocked<FloorPlanService>;
    let performanceMonitor: { start: () => void; end: () => number };

    beforeEach(() => {
        // Reset mocks and initialize test environment
        jest.clearAllMocks();
        MockDate.set(TEST_CONSTANTS.MOCK_DATE);

        // Initialize mock service
        mockFloorPlanService = {
            createFloorPlan: jest.fn(),
            getFloorPlanById: jest.fn(),
            getAllFloorPlans: jest.fn(),
            updateFloorPlan: jest.fn(),
            deleteFloorPlan: jest.fn(),
            updateEntityPlacements: jest.fn()
        } as unknown as jest.Mocked<FloorPlanService>;

        // Initialize performance monitor
        performanceMonitor = {
            start: jest.fn(() => performance.now()),
            end: jest.fn(() => performance.now())
        };

        // Initialize controller with mocked service
        controller = new FloorPlanController(mockFloorPlanService);
    });

    afterEach(() => {
        MockDate.reset();
        jest.resetModules();
    });

    describe('createFloorPlan', () => {
        it('should create a floor plan and return 201 status within performance threshold', async () => {
            // Arrange
            const req = {
                body: {
                    name: mockFloorPlan.name,
                    svgData: mockFloorPlan.svgData,
                    dimensions: mockFloorPlan.dimensions,
                    scale: mockFloorPlan.scale,
                    order: mockFloorPlan.order
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            mockFloorPlanService.createFloorPlan.mockResolvedValue(mockFloorPlan);

            // Act
            performanceMonitor.start();
            await controller.createFloorPlan(req as any, res as any);
            const executionTime = performanceMonitor.end();

            // Assert
            expect(executionTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLD);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockFloorPlan
            });
        });

        it('should validate floor plan data and return 400 for invalid input', async () => {
            // Arrange
            const req = {
                body: {
                    name: '', // Invalid name
                    svgData: 'invalid svg'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            // Act
            await controller.createFloorPlan(req as any, res as any);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                errors: expect.any(Array)
            });
        });

        it('should handle large SVG data and return 400 if size exceeds limit', async () => {
            // Arrange
            const largeSvg = 'x'.repeat(TEST_CONSTANTS.MAX_SVG_SIZE + 1);
            const req = {
                body: {
                    ...mockFloorPlan,
                    svgData: largeSvg
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            // Act
            await controller.createFloorPlan(req as any, res as any);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                errors: expect.arrayContaining(['SVG data exceeds maximum size limit'])
            });
        });
    });

    describe('getFloorPlan', () => {
        it('should retrieve a floor plan by ID within performance threshold', async () => {
            // Arrange
            const req = {
                params: { id: mockFloorPlan.id }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            mockFloorPlanService.getFloorPlanById.mockResolvedValue(mockFloorPlan);

            // Act
            performanceMonitor.start();
            await controller.getFloorPlan(req as any, res as any);
            const executionTime = performanceMonitor.end();

            // Assert
            expect(executionTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLD);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockFloorPlan
            });
        });

        it('should return 404 for non-existent floor plan', async () => {
            // Arrange
            const req = {
                params: { id: 'non-existent-id' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            mockFloorPlanService.getFloorPlanById.mockResolvedValue(null);

            // Act
            await controller.getFloorPlan(req as any, res as any);

            // Assert
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Floor plan not found'
            });
        });
    });

    describe('getAllFloorPlans', () => {
        it('should retrieve all floor plans with pagination within performance threshold', async () => {
            // Arrange
            const mockFloorPlans = [mockFloorPlan];
            const req = {};
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            mockFloorPlanService.getAllFloorPlans.mockResolvedValue(mockFloorPlans);

            // Act
            performanceMonitor.start();
            await controller.getAllFloorPlans(req as any, res as any);
            const executionTime = performanceMonitor.end();

            // Assert
            expect(executionTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLD);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockFloorPlans
            });
        });
    });

    describe('updateFloorPlan', () => {
        it('should update a floor plan and return 200 status within performance threshold', async () => {
            // Arrange
            const updateData = {
                name: 'Updated Floor Plan',
                scale: 1.5
            };
            const req = {
                params: { id: mockFloorPlan.id },
                body: updateData
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const updatedFloorPlan = { ...mockFloorPlan, ...updateData };
            mockFloorPlanService.updateFloorPlan.mockResolvedValue(updatedFloorPlan);

            // Act
            performanceMonitor.start();
            await controller.updateFloorPlan(req as any, res as any);
            const executionTime = performanceMonitor.end();

            // Assert
            expect(executionTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLD);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: updatedFloorPlan
            });
        });

        it('should validate update data and return 400 for invalid input', async () => {
            // Arrange
            const req = {
                params: { id: mockFloorPlan.id },
                body: {
                    scale: -1 // Invalid scale
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            // Act
            await controller.updateFloorPlan(req as any, res as any);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                errors: expect.any(Array)
            });
        });
    });

    describe('deleteFloorPlan', () => {
        it('should delete a floor plan and return 204 status within performance threshold', async () => {
            // Arrange
            const req = {
                params: { id: mockFloorPlan.id }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            mockFloorPlanService.deleteFloorPlan.mockResolvedValue(undefined);

            // Act
            performanceMonitor.start();
            await controller.deleteFloorPlan(req as any, res as any);
            const executionTime = performanceMonitor.end();

            // Assert
            expect(executionTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLD);
            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.send).toHaveBeenCalled();
        });
    });

    describe('updateEntityPlacements', () => {
        it('should update entity placements and return 200 status within performance threshold', async () => {
            // Arrange
            const placements = [
                { entityId: 'entity1', x: 10, y: 20, scale: 1 }
            ];
            const req = {
                params: { id: mockFloorPlan.id },
                body: { placements }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const updatedFloorPlan = { ...mockFloorPlan, entityPlacements: placements };
            mockFloorPlanService.updateEntityPlacements.mockResolvedValue(updatedFloorPlan);

            // Act
            performanceMonitor.start();
            await controller.updateEntityPlacements(req as any, res as any);
            const executionTime = performanceMonitor.end();

            // Assert
            expect(executionTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLD);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: updatedFloorPlan
            });
        });

        it('should validate entity placements and return 400 for invalid input', async () => {
            // Arrange
            const req = {
                params: { id: mockFloorPlan.id },
                body: {
                    placements: [
                        { entityId: 'entity1', x: -1, y: -1, scale: 0 } // Invalid coordinates
                    ]
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            // Act
            await controller.updateEntityPlacements(req as any, res as any);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                errors: expect.any(Array)
            });
        });
    });
});
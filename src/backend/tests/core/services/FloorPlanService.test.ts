import { describe, beforeEach, it, expect, jest } from '@jest/globals'; // ^29.0.0
import { Container } from 'inversify'; // ^6.0.1
import { FloorPlanService } from '../../../src/core/services/FloorPlanService';
import { FloorPlanRepository } from '../../../src/database/repositories/FloorPlanRepository';
import { IFloorPlan } from '../../../src/core/interfaces/IFloorPlan';
import { FloorPlanStatus } from '../../../src/core/types/FloorPlan.types';

describe('FloorPlanService', () => {
    let container: Container;
    let floorPlanService: FloorPlanService;
    let mockFloorPlanRepository: jest.Mocked<FloorPlanRepository>;
    let mockCache: jest.Mocked<any>;
    let mockRateLimiter: jest.Mocked<any>;
    let mockLogger: jest.Mocked<any>;

    // Test data fixtures
    const mockFloorPlan: IFloorPlan = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Ground Floor',
        svgData: '<svg width="800" height="600">...</svg>',
        dimensions: { width: 800, height: 600 },
        scale: 1.0,
        order: 0,
        entityPlacements: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockEntityPlacement = {
        entityId: 'light.living_room',
        x: 100,
        y: 200,
        scale: 1.0
    };

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Initialize container and mocks
        container = new Container();

        // Mock repository
        mockFloorPlanRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            updateEntityPlacements: jest.fn(),
            beginTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn()
        } as unknown as jest.Mocked<FloorPlanRepository>;

        // Mock cache
        mockCache = {
            connect: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn()
        };

        // Mock rate limiter
        mockRateLimiter = {
            initialize: jest.fn(),
            checkLimit: jest.fn().mockResolvedValue(true)
        };

        // Mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };

        // Bind dependencies
        container.bind(FloorPlanRepository).toConstantValue(mockFloorPlanRepository);
        container.bind('Cache').toConstantValue(mockCache);
        container.bind('RateLimiter').toConstantValue(mockRateLimiter);
        container.bind('Logger').toConstantValue(mockLogger);
        container.bind(FloorPlanService).toSelf();

        // Create service instance
        floorPlanService = container.get(FloorPlanService);
    });

    describe('initialization', () => {
        it('should initialize service successfully', async () => {
            expect(mockCache.connect).toHaveBeenCalled();
            expect(mockRateLimiter.initialize).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('Initializing FloorPlanService');
        });

        it('should handle initialization failure', async () => {
            const error = new Error('Cache connection failed');
            mockCache.connect.mockRejectedValueOnce(error);

            await expect(floorPlanService['initializeService']()).rejects.toThrow(error);
            expect(mockLogger.error).toHaveBeenCalledWith('FloorPlanService initialization failed:', error);
        });
    });

    describe('createFloorPlan', () => {
        it('should create floor plan successfully', async () => {
            mockFloorPlanRepository.create.mockResolvedValueOnce(mockFloorPlan);

            const result = await floorPlanService.createFloorPlan(mockFloorPlan);

            expect(result).toEqual(mockFloorPlan);
            expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('createFloorPlan');
            expect(mockFloorPlanRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                name: mockFloorPlan.name,
                svgData: expect.any(String),
                dimensions: expect.any(Object)
            }));
            expect(mockLogger.info).toHaveBeenCalledWith(`Floor plan created successfully: ${mockFloorPlan.id}`);
        });

        it('should handle validation failure', async () => {
            const invalidFloorPlan = { ...mockFloorPlan, name: '' };

            await expect(floorPlanService.createFloorPlan(invalidFloorPlan))
                .rejects.toThrow(/Floor plan validation failed/);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should handle rate limit exceeded', async () => {
            mockRateLimiter.checkLimit.mockRejectedValueOnce(new Error('Rate limit exceeded'));

            await expect(floorPlanService.createFloorPlan(mockFloorPlan))
                .rejects.toThrow('Rate limit exceeded');
        });
    });

    describe('getFloorPlanById', () => {
        it('should return cached floor plan if available', async () => {
            const cachedPlan = { ...mockFloorPlan };
            floorPlanService['floorPlanCache'].set(mockFloorPlan.id, {
                data: cachedPlan,
                timestamp: Date.now()
            });

            const result = await floorPlanService.getFloorPlanById(mockFloorPlan.id);

            expect(result).toEqual(cachedPlan);
            expect(mockFloorPlanRepository.findById).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(`Cache hit for floor plan: ${mockFloorPlan.id}`);
        });

        it('should fetch from repository if not cached', async () => {
            mockFloorPlanRepository.findById.mockResolvedValueOnce(mockFloorPlan);

            const result = await floorPlanService.getFloorPlanById(mockFloorPlan.id);

            expect(result).toEqual(mockFloorPlan);
            expect(mockFloorPlanRepository.findById).toHaveBeenCalledWith(mockFloorPlan.id);
        });

        it('should handle repository errors', async () => {
            mockFloorPlanRepository.findById.mockRejectedValueOnce(new Error('Database error'));

            await expect(floorPlanService.getFloorPlanById(mockFloorPlan.id))
                .rejects.toThrow('Database error');
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('getAllFloorPlans', () => {
        it('should return all floor plans and cache them', async () => {
            const floorPlans = [mockFloorPlan];
            mockFloorPlanRepository.findAll.mockResolvedValueOnce({ data: floorPlans, total: 1 });

            const result = await floorPlanService.getAllFloorPlans();

            expect(result).toEqual(floorPlans);
            expect(mockLogger.info).toHaveBeenCalledWith(`Retrieved ${floorPlans.length} floor plans`);
            expect(floorPlanService['floorPlanCache'].get(mockFloorPlan.id)).toBeDefined();
        });

        it('should handle empty result', async () => {
            mockFloorPlanRepository.findAll.mockResolvedValueOnce({ data: [], total: 0 });

            const result = await floorPlanService.getAllFloorPlans();

            expect(result).toEqual([]);
            expect(mockLogger.info).toHaveBeenCalledWith('Retrieved 0 floor plans');
        });
    });

    describe('updateFloorPlan', () => {
        it('should update floor plan successfully', async () => {
            const updateData = { name: 'Updated Floor' };
            const updatedPlan = { ...mockFloorPlan, ...updateData };
            mockFloorPlanRepository.update.mockResolvedValueOnce(updatedPlan);

            const result = await floorPlanService.updateFloorPlan(mockFloorPlan.id, updateData);

            expect(result).toEqual(updatedPlan);
            expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('updateFloorPlan');
            expect(mockLogger.info).toHaveBeenCalledWith(`Floor plan updated successfully: ${mockFloorPlan.id}`);
        });

        it('should handle non-existent floor plan', async () => {
            mockFloorPlanRepository.update.mockResolvedValueOnce(null);

            await expect(floorPlanService.updateFloorPlan(mockFloorPlan.id, { name: 'New Name' }))
                .rejects.toThrow(`Floor plan not found: ${mockFloorPlan.id}`);
        });
    });

    describe('deleteFloorPlan', () => {
        it('should delete floor plan and clear cache', async () => {
            mockFloorPlanRepository.delete.mockResolvedValueOnce(true);

            await floorPlanService.deleteFloorPlan(mockFloorPlan.id);

            expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('deleteFloorPlan');
            expect(mockFloorPlanRepository.delete).toHaveBeenCalledWith(mockFloorPlan.id);
            expect(floorPlanService['floorPlanCache'].has(mockFloorPlan.id)).toBeFalsy();
            expect(mockLogger.info).toHaveBeenCalledWith(`Floor plan deleted successfully: ${mockFloorPlan.id}`);
        });

        it('should handle non-existent floor plan', async () => {
            mockFloorPlanRepository.delete.mockResolvedValueOnce(false);

            await expect(floorPlanService.deleteFloorPlan(mockFloorPlan.id))
                .rejects.toThrow(`Floor plan not found: ${mockFloorPlan.id}`);
        });
    });

    describe('updateEntityPlacements', () => {
        it('should update entity placements successfully', async () => {
            const updatedPlan = {
                ...mockFloorPlan,
                entityPlacements: [mockEntityPlacement]
            };
            mockFloorPlanRepository.updateEntityPlacements.mockResolvedValueOnce(updatedPlan);

            const result = await floorPlanService.updateEntityPlacements(
                mockFloorPlan.id,
                [mockEntityPlacement]
            );

            expect(result).toEqual(updatedPlan);
            expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('updateEntityPlacements');
            expect(mockLogger.info).toHaveBeenCalledWith(`Entity placements updated for floor plan: ${mockFloorPlan.id}`);
        });

        it('should handle invalid entity placements', async () => {
            mockFloorPlanRepository.updateEntityPlacements.mockResolvedValueOnce(null);

            await expect(floorPlanService.updateEntityPlacements(mockFloorPlan.id, [mockEntityPlacement]))
                .rejects.toThrow(`Floor plan not found: ${mockFloorPlan.id}`);
        });
    });

    describe('cache management', () => {
        it('should handle cache updates correctly', () => {
            floorPlanService['updateCache'](mockFloorPlan.id, mockFloorPlan);
            
            const cached = floorPlanService['getCachedFloorPlan'](mockFloorPlan.id);
            expect(cached).toEqual(mockFloorPlan);
        });

        it('should handle cache expiration', () => {
            floorPlanService['updateCache'](mockFloorPlan.id, mockFloorPlan);
            
            // Simulate cache expiration by manipulating the timestamp
            const cacheEntry = floorPlanService['floorPlanCache'].get(mockFloorPlan.id);
            if (cacheEntry) {
                cacheEntry.timestamp = Date.now() - (300001); // Just over 5 minutes
            }

            const cached = floorPlanService['getCachedFloorPlan'](mockFloorPlan.id);
            expect(cached).toBeNull();
        });

        it('should clear cache correctly', () => {
            floorPlanService['updateCache'](mockFloorPlan.id, mockFloorPlan);
            floorPlanService['clearCache'](mockFloorPlan.id);
            
            expect(floorPlanService['floorPlanCache'].has(mockFloorPlan.id)).toBeFalsy();
        });
    });
});
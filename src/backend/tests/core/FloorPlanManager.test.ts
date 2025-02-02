import { Container } from 'inversify'; // v6.0.1
import { jest } from '@jest/globals'; // v29.0.0
import { FloorPlanManager } from '../../src/core/FloorPlanManager';
import { FloorPlanService } from '../../src/core/services/FloorPlanService';
import { IFloorPlan, EntityPlacement } from '../../src/core/interfaces/IFloorPlan';

// Mock the FloorPlanService
jest.mock('../../src/core/services/FloorPlanService');

describe('FloorPlanManager', () => {
    let container: Container;
    let floorPlanManager: FloorPlanManager;
    let mockFloorPlanService: jest.Mocked<FloorPlanService>;

    // Test data
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

    const mockEntityPlacement: EntityPlacement = {
        entityId: 'light.living_room',
        x: 100,
        y: 100,
        scale: 1.0
    };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create new container
        container = new Container();

        // Create mock service
        mockFloorPlanService = {
            createFloorPlan: jest.fn(),
            getFloorPlanById: jest.fn(),
            getAllFloorPlans: jest.fn(),
            updateFloorPlan: jest.fn(),
            deleteFloorPlan: jest.fn(),
            updateEntityPlacements: jest.fn()
        } as unknown as jest.Mocked<FloorPlanService>;

        // Bind dependencies
        container.bind(FloorPlanService).toConstantValue(mockFloorPlanService);
        container.bind(FloorPlanManager).toSelf();

        // Create manager instance
        floorPlanManager = container.get(FloorPlanManager);
    });

    describe('createFloorPlan', () => {
        it('should create a floor plan and emit creation event', async () => {
            // Setup
            const eventSpy = jest.spyOn(floorPlanManager['eventEmitter'], 'emit');
            mockFloorPlanService.createFloorPlan.mockResolvedValue(mockFloorPlan);

            // Execute
            const result = await floorPlanManager.createFloorPlan(mockFloorPlan);

            // Verify
            expect(mockFloorPlanService.createFloorPlan).toHaveBeenCalledWith(mockFloorPlan);
            expect(result).toEqual(mockFloorPlan);
            expect(eventSpy).toHaveBeenCalledWith('floorPlan:created', mockFloorPlan);
        });

        it('should handle creation errors gracefully', async () => {
            // Setup
            const error = new Error('Creation failed');
            mockFloorPlanService.createFloorPlan.mockRejectedValue(error);

            // Execute & Verify
            await expect(floorPlanManager.createFloorPlan(mockFloorPlan))
                .rejects.toThrow('Failed to create floor plan: Creation failed');
        });
    });

    describe('getFloorPlan', () => {
        it('should return cached floor plan if available and valid', async () => {
            // Setup
            const cachedPlan = { ...mockFloorPlan };
            floorPlanManager['floorPlanCache'].set(mockFloorPlan.id, {
                data: cachedPlan,
                timestamp: Date.now()
            });

            // Execute
            const result = await floorPlanManager.getFloorPlan(mockFloorPlan.id);

            // Verify
            expect(result).toEqual(cachedPlan);
            expect(mockFloorPlanService.getFloorPlanById).not.toHaveBeenCalled();
        });

        it('should fetch from service if cache is invalid', async () => {
            // Setup
            mockFloorPlanService.getFloorPlanById.mockResolvedValue(mockFloorPlan);

            // Execute
            const result = await floorPlanManager.getFloorPlan(mockFloorPlan.id);

            // Verify
            expect(mockFloorPlanService.getFloorPlanById).toHaveBeenCalledWith(mockFloorPlan.id);
            expect(result).toEqual(mockFloorPlan);
        });
    });

    describe('getAllFloorPlans', () => {
        it('should retrieve and cache all floor plans', async () => {
            // Setup
            const mockPlans = [mockFloorPlan];
            mockFloorPlanService.getAllFloorPlans.mockResolvedValue(mockPlans);

            // Execute
            const result = await floorPlanManager.getAllFloorPlans();

            // Verify
            expect(mockFloorPlanService.getAllFloorPlans).toHaveBeenCalled();
            expect(result).toEqual(mockPlans);
            expect(floorPlanManager['floorPlanCache'].get(mockFloorPlan.id)?.data).toEqual(mockFloorPlan);
        });
    });

    describe('updateFloorPlan', () => {
        it('should update floor plan and emit update event', async () => {
            // Setup
            const eventSpy = jest.spyOn(floorPlanManager['eventEmitter'], 'emit');
            const updateData = { name: 'Updated Floor' };
            const updatedPlan = { ...mockFloorPlan, ...updateData };
            mockFloorPlanService.updateFloorPlan.mockResolvedValue(updatedPlan);

            // Execute
            const result = await floorPlanManager.updateFloorPlan(mockFloorPlan.id, updateData);

            // Verify
            expect(mockFloorPlanService.updateFloorPlan).toHaveBeenCalledWith(mockFloorPlan.id, updateData);
            expect(result).toEqual(updatedPlan);
            expect(eventSpy).toHaveBeenCalledWith('floorPlan:updated', updatedPlan);
        });
    });

    describe('deleteFloorPlan', () => {
        it('should delete floor plan and emit deletion event', async () => {
            // Setup
            const eventSpy = jest.spyOn(floorPlanManager['eventEmitter'], 'emit');
            mockFloorPlanService.deleteFloorPlan.mockResolvedValue();

            // Execute
            await floorPlanManager.deleteFloorPlan(mockFloorPlan.id);

            // Verify
            expect(mockFloorPlanService.deleteFloorPlan).toHaveBeenCalledWith(mockFloorPlan.id);
            expect(floorPlanManager['floorPlanCache'].has(mockFloorPlan.id)).toBeFalsy();
            expect(eventSpy).toHaveBeenCalledWith('floorPlan:deleted', mockFloorPlan.id);
        });
    });

    describe('updateEntityPlacements', () => {
        it('should update entity placements and emit update event', async () => {
            // Setup
            const eventSpy = jest.spyOn(floorPlanManager['eventEmitter'], 'emit');
            const placements = [mockEntityPlacement];
            const updatedPlan = { ...mockFloorPlan, entityPlacements: placements };
            mockFloorPlanService.updateEntityPlacements.mockResolvedValue(updatedPlan);

            // Execute
            const result = await floorPlanManager.updateEntityPlacements(mockFloorPlan.id, placements);

            // Verify
            expect(mockFloorPlanService.updateEntityPlacements).toHaveBeenCalledWith(mockFloorPlan.id, placements);
            expect(result).toEqual(updatedPlan);
            expect(eventSpy).toHaveBeenCalledWith('floorPlan:entityPlacementsUpdated', {
                floorPlanId: mockFloorPlan.id,
                placements
            });
        });
    });

    describe('subscribeToUpdates', () => {
        it('should register event listeners and return unsubscribe function', () => {
            // Setup
            const callback = jest.fn();
            const events = [
                'floorPlan:created',
                'floorPlan:updated',
                'floorPlan:deleted',
                'floorPlan:entityPlacementsUpdated'
            ];

            // Execute
            const unsubscribe = floorPlanManager.subscribeToUpdates(callback);

            // Emit test events
            events.forEach(event => {
                floorPlanManager['eventEmitter'].emit(event, { test: 'data' });
            });

            // Verify
            expect(callback).toHaveBeenCalledTimes(events.length);

            // Test unsubscribe
            unsubscribe();
            events.forEach(event => {
                floorPlanManager['eventEmitter'].emit(event, { test: 'data' });
            });

            // Verify no additional calls after unsubscribe
            expect(callback).toHaveBeenCalledTimes(events.length);
        });
    });
});
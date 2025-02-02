import { describe, test, expect, jest, beforeEach } from '@jest/globals'; // v29.0.0
import { 
    processFloorPlan, 
    validateEntityPlacements, 
    updateEntityPlacement, 
    removeEntityPlacement 
} from '../../../src/core/utils/floorPlanProcessor';
import type { IFloorPlan, EntityPlacement } from '../../../src/core/interfaces/IFloorPlan';

// Test Constants
const VALID_SVG_DATA = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800">
    <rect width="1000" height="800" fill="none" stroke="#000"/>
    <path d="M0 0h1000v800H0z"/>
</svg>`;

const INVALID_SVG_DATA = '<svg><invalid>data</invalid></svg>';

const MOCK_DIMENSIONS = {
    width: 1000,
    height: 800,
    scale: 100
};

// Mock Data
const mockValidFloorPlan: IFloorPlan = {
    id: 'test-floor-plan',
    name: 'Test Floor Plan',
    svgData: VALID_SVG_DATA,
    dimensions: MOCK_DIMENSIONS,
    scale: 1,
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

describe('Floor Plan Processor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processFloorPlan', () => {
        test('should successfully process a valid floor plan', async () => {
            const result = await processFloorPlan(mockValidFloorPlan);
            
            expect(result).toBeDefined();
            expect(result.id).toBe(mockValidFloorPlan.id);
            expect(result.svgData).toBeDefined();
            expect(result.dimensions).toEqual(MOCK_DIMENSIONS);
            expect(result.entityPlacements).toEqual([]);
        });

        test('should reject floor plan with invalid SVG data', async () => {
            const invalidPlan = {
                ...mockValidFloorPlan,
                svgData: INVALID_SVG_DATA
            };

            await expect(processFloorPlan(invalidPlan))
                .rejects
                .toThrow('Floor plan validation failed');
        });

        test('should handle floor plan with missing dimensions', async () => {
            const invalidPlan = {
                ...mockValidFloorPlan,
                dimensions: {}
            };

            await expect(processFloorPlan(invalidPlan))
                .rejects
                .toThrow('Floor plan validation failed');
        });

        test('should process floor plan within performance limits', async () => {
            const startTime = Date.now();
            await processFloorPlan(mockValidFloorPlan);
            const processingTime = Date.now() - startTime;
            
            expect(processingTime).toBeLessThan(500); // 500ms limit
        });

        test('should handle floor plan with maximum entity limit', async () => {
            const maxEntities = Array(100).fill(null).map((_, index) => ({
                entityId: `light.test_${index}`,
                x: 100,
                y: 100,
                scale: 1.0
            }));

            const planWithMaxEntities = {
                ...mockValidFloorPlan,
                entityPlacements: maxEntities
            };

            const result = await processFloorPlan(planWithMaxEntities);
            expect(result.entityPlacements).toHaveLength(100);
        });
    });

    describe('validateEntityPlacements', () => {
        test('should validate valid entity placements', async () => {
            const validPlacements = [mockEntityPlacement];
            const result = await validateEntityPlacements(validPlacements, MOCK_DIMENSIONS);
            expect(result).toBe(true);
        });

        test('should reject out-of-bounds entity placement', async () => {
            const outOfBoundsPlacement = {
                ...mockEntityPlacement,
                x: MOCK_DIMENSIONS.width + 100
            };

            await expect(validateEntityPlacements([outOfBoundsPlacement], MOCK_DIMENSIONS))
                .rejects
                .toThrow('Entity placement coordinates out of bounds');
        });

        test('should reject invalid scale values', async () => {
            const invalidScalePlacement = {
                ...mockEntityPlacement,
                scale: 0
            };

            await expect(validateEntityPlacements([invalidScalePlacement], MOCK_DIMENSIONS))
                .rejects
                .toThrow('Entity scale out of allowed range');
        });

        test('should reject duplicate entity IDs', async () => {
            const duplicatePlacements = [
                mockEntityPlacement,
                { ...mockEntityPlacement }
            ];

            await expect(validateEntityPlacements(duplicatePlacements, MOCK_DIMENSIONS))
                .rejects
                .toThrow('Duplicate entity ID detected');
        });
    });

    describe('updateEntityPlacement', () => {
        test('should successfully update existing entity placement', async () => {
            const floorPlan = {
                ...mockValidFloorPlan,
                entityPlacements: [mockEntityPlacement]
            };

            const updatedPlacement = {
                ...mockEntityPlacement,
                x: 200,
                y: 200
            };

            const result = await updateEntityPlacement(
                floorPlan,
                mockEntityPlacement.entityId,
                updatedPlacement
            );

            expect(result.entityPlacements[0]).toEqual(updatedPlacement);
        });

        test('should reject invalid placement update', async () => {
            const floorPlan = {
                ...mockValidFloorPlan,
                entityPlacements: [mockEntityPlacement]
            };

            const invalidPlacement = {
                ...mockEntityPlacement,
                x: -100
            };

            await expect(updateEntityPlacement(
                floorPlan,
                mockEntityPlacement.entityId,
                invalidPlacement
            )).rejects.toThrow('Invalid entity placement');
        });

        test('should maintain other entity placements during update', async () => {
            const otherPlacement = {
                entityId: 'light.kitchen',
                x: 300,
                y: 300,
                scale: 1.0
            };

            const floorPlan = {
                ...mockValidFloorPlan,
                entityPlacements: [mockEntityPlacement, otherPlacement]
            };

            const updatedPlacement = {
                ...mockEntityPlacement,
                x: 200
            };

            const result = await updateEntityPlacement(
                floorPlan,
                mockEntityPlacement.entityId,
                updatedPlacement
            );

            expect(result.entityPlacements).toHaveLength(2);
            expect(result.entityPlacements).toContainEqual(otherPlacement);
        });
    });

    describe('removeEntityPlacement', () => {
        test('should successfully remove existing entity placement', async () => {
            const floorPlan = {
                ...mockValidFloorPlan,
                entityPlacements: [mockEntityPlacement]
            };

            const result = await removeEntityPlacement(
                floorPlan,
                mockEntityPlacement.entityId
            );

            expect(result.entityPlacements).toHaveLength(0);
        });

        test('should handle removal of non-existent entity', async () => {
            const floorPlan = {
                ...mockValidFloorPlan,
                entityPlacements: [mockEntityPlacement]
            };

            const result = await removeEntityPlacement(
                floorPlan,
                'non.existent'
            );

            expect(result.entityPlacements).toHaveLength(1);
            expect(result.entityPlacements[0]).toEqual(mockEntityPlacement);
        });

        test('should maintain floor plan integrity after removal', async () => {
            const floorPlan = {
                ...mockValidFloorPlan,
                entityPlacements: [mockEntityPlacement]
            };

            const result = await removeEntityPlacement(
                floorPlan,
                mockEntityPlacement.entityId
            );

            expect(result.id).toBe(floorPlan.id);
            expect(result.svgData).toBe(floorPlan.svgData);
            expect(result.dimensions).toEqual(floorPlan.dimensions);
        });
    });
});
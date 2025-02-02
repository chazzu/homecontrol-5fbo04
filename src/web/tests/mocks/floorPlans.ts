/**
 * @file Floor Plan Mock Data
 * @version 1.0.0
 * 
 * Comprehensive mock data for testing floor plan management, entity placement,
 * and validation scenarios. Provides diverse test cases for all floor plan features.
 */

import { FloorPlan } from '../../src/types/floorPlan.types';
import { EntityPosition } from '../../src/types/entity.types';

// Constants for floor plan dimensions and validation
const DEFAULT_DIMENSIONS = { width: 800, height: 600, aspectRatio: 4/3 };
const MAX_DIMENSIONS = { width: 3840, height: 2160, aspectRatio: 16/9 };

// Sample SVG data for testing
const MOCK_SVG_DATA = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect x="0" y="0" width="800" height="600" fill="#f5f5f5"/>
  <rect x="100" y="100" width="300" height="200" fill="none" stroke="#000"/>
  <rect x="400" y="100" width="200" height="200" fill="none" stroke="#000"/>
  <text x="200" y="200">Living Room</text>
  <text x="500" y="200">Kitchen</text>
</svg>`;

// Test entity IDs for consistent testing
const TEST_ENTITY_IDS = [
  'light.living_room',
  'switch.kitchen',
  'sensor.temperature',
  'camera.entrance'
];

/**
 * Creates a mock floor plan with comprehensive validation
 */
function createMockFloorPlan(
  id: string,
  name: string,
  dimensions = DEFAULT_DIMENSIONS,
  entityPlacements = new Map<string, EntityPosition>()
): FloorPlan {
  return {
    id,
    name,
    svgData: MOCK_SVG_DATA,
    dimensions,
    scale: 50, // 50 pixels per meter
    order: 0,
    entityPlacements,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
      customData: {}
    }
  };
}

/**
 * Mock entity placements for testing various scenarios
 */
export const mockEntityPlacements = new Map<string, EntityPosition>([
  ['light.living_room', { x: 150, y: 150, scale: 1, rotation: 0 }],
  ['switch.kitchen', { x: 450, y: 150, scale: 1, rotation: 90 }],
  ['sensor.temperature', { x: 300, y: 250, scale: 0.8, rotation: 0 }],
  ['camera.entrance', { x: 100, y: 100, scale: 1.2, rotation: 45 }]
]);

/**
 * Comprehensive collection of mock floor plans for testing
 */
export const mockFloorPlans = new Map<string, FloorPlan>([
  // Standard floor plan with entities
  ['ground-floor', createMockFloorPlan(
    'ground-floor',
    'Ground Floor',
    DEFAULT_DIMENSIONS,
    mockEntityPlacements
  )],

  // Floor plan with different dimensions
  ['first-floor', createMockFloorPlan(
    'first-floor',
    'First Floor',
    { width: 1024, height: 768, aspectRatio: 4/3 },
    new Map([
      ['light.bedroom', { x: 200, y: 200, scale: 1, rotation: 0 }],
      ['sensor.humidity', { x: 300, y: 300, scale: 0.9, rotation: 0 }]
    ])
  )],

  // Empty floor plan for testing no-entity scenarios
  ['empty-floor', createMockFloorPlan(
    'empty-floor',
    'Empty Floor',
    DEFAULT_DIMENSIONS,
    new Map()
  )],

  // Maximum size floor plan for testing boundaries
  ['max-size-floor', createMockFloorPlan(
    'max-size-floor',
    'Maximum Size Floor',
    MAX_DIMENSIONS,
    new Map([
      ['light.corner', { x: MAX_DIMENSIONS.width - 50, y: MAX_DIMENSIONS.height - 50, scale: 1, rotation: 0 }]
    ])
  )]
]);

// Add test cases for validation scenarios
mockFloorPlans.set('invalid-dimensions', {
  ...createMockFloorPlan('invalid-dimensions', 'Invalid Dimensions'),
  dimensions: { width: -100, height: -100, aspectRatio: -1 }
});

mockFloorPlans.set('zero-dimensions', {
  ...createMockFloorPlan('zero-dimensions', 'Zero Dimensions'),
  dimensions: { width: 0, height: 0, aspectRatio: 0 }
});

// Add test case for overlapping entities
const overlappingPlacements = new Map<string, EntityPosition>([
  ['light.overlap1', { x: 200, y: 200, scale: 1, rotation: 0 }],
  ['light.overlap2', { x: 200, y: 200, scale: 1, rotation: 0 }]
]);

mockFloorPlans.set('overlapping-entities', createMockFloorPlan(
  'overlapping-entities',
  'Overlapping Entities',
  DEFAULT_DIMENSIONS,
  overlappingPlacements
));

// Add test case for maximum entity count
const maxEntityPlacements = new Map<string, EntityPosition>();
for (let i = 0; i < 100; i++) {
  maxEntityPlacements.set(`light.test_${i}`, {
    x: Math.random() * DEFAULT_DIMENSIONS.width,
    y: Math.random() * DEFAULT_DIMENSIONS.height,
    scale: 1,
    rotation: 0
  });
}

mockFloorPlans.set('max-entities', createMockFloorPlan(
  'max-entities',
  'Maximum Entities',
  DEFAULT_DIMENSIONS,
  maxEntityPlacements
));

/**
 * Test case for boundary conditions and edge cases
 */
mockFloorPlans.set('edge-cases', createMockFloorPlan(
  'edge-cases',
  'Edge Cases',
  DEFAULT_DIMENSIONS,
  new Map([
    // Entity at exact boundary
    ['light.boundary', { x: DEFAULT_DIMENSIONS.width, y: DEFAULT_DIMENSIONS.height, scale: 1, rotation: 0 }],
    // Entity with minimum scale
    ['light.min_scale', { x: 100, y: 100, scale: 0.1, rotation: 0 }],
    // Entity with maximum scale
    ['light.max_scale', { x: 200, y: 200, scale: 5, rotation: 0 }],
    // Entity with maximum rotation
    ['light.max_rotation', { x: 300, y: 300, scale: 1, rotation: 359 }]
  ])
));
/**
 * @file Mock Entity Data for Testing
 * @version 1.0.0
 * 
 * Provides comprehensive mock entity data and handlers for testing the Smart Home Dashboard's
 * entity-related components with realistic state management and command handling simulation.
 */

import { jest } from '@jest/globals';
import { EntityType, EntityConfig } from '../../src/types/entity.types';
import type { HAEntityState } from '../../backend/src/types/homeAssistant';

/**
 * Mock entity states with comprehensive attributes and timestamps
 */
export const mockEntityStates: Record<string, HAEntityState> = {
  'light.living_room': {
    entity_id: 'light.living_room',
    state: 'on',
    attributes: {
      brightness: 255,
      color_temp: 400,
      friendly_name: 'Living Room Light',
      supported_features: 63,
      rgb_color: [255, 255, 255],
      effect_list: ['colorloop', 'random'],
      min_mireds: 153,
      max_mireds: 500
    },
    context: {
      id: '01ABCD123',
      parent_id: null,
      user_id: 'mock_user_1'
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString()
  },
  'switch.kitchen': {
    entity_id: 'switch.kitchen',
    state: 'off',
    attributes: {
      friendly_name: 'Kitchen Switch',
      current_power_w: 0,
      today_energy_kwh: 0.5,
      device_class: 'outlet'
    },
    context: {
      id: '01ABCD124',
      parent_id: null,
      user_id: 'mock_user_1'
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString()
  },
  'climate.bedroom': {
    entity_id: 'climate.bedroom',
    state: 'heat',
    attributes: {
      temperature: 21.5,
      current_temperature: 20,
      min_temp: 7,
      max_temp: 35,
      hvac_modes: ['off', 'heat', 'cool', 'auto'],
      fan_modes: ['auto', 'low', 'medium', 'high'],
      preset_modes: ['eco', 'comfort', 'boost'],
      friendly_name: 'Bedroom Climate'
    },
    context: {
      id: '01ABCD125',
      parent_id: null,
      user_id: 'mock_user_1'
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString()
  }
};

/**
 * Mock entity configurations with floor plan positions and display settings
 */
export const mockEntityConfigs: Record<string, EntityConfig> = {
  'light.living_room': {
    entity_id: 'light.living_room',
    type: EntityType.LIGHT,
    position: {
      x: 100,
      y: 150,
      scale: 1,
      rotation: 0
    },
    floor_id: 'floor_1',
    visible: true,
    custom_settings: {
      defaultBrightness: 80,
      transitionDuration: 400
    },
    display_name: 'Living Room Light',
    icon_override: null
  },
  'switch.kitchen': {
    entity_id: 'switch.kitchen',
    type: EntityType.SWITCH,
    position: {
      x: 250,
      y: 300,
      scale: 1,
      rotation: 0
    },
    floor_id: 'floor_1',
    visible: true,
    custom_settings: {
      powerMonitoring: true,
      energyTracking: true
    },
    display_name: 'Kitchen Switch',
    icon_override: 'mdi:power-socket'
  },
  'climate.bedroom': {
    entity_id: 'climate.bedroom',
    type: EntityType.CLIMATE,
    position: {
      x: 400,
      y: 200,
      scale: 1.2,
      rotation: 0
    },
    floor_id: 'floor_1',
    visible: true,
    custom_settings: {
      defaultPreset: 'comfort',
      showControls: true
    },
    display_name: 'Bedroom Climate',
    icon_override: null
  }
};

/**
 * Creates a mock entity state with proper timestamps and validation
 */
const createMockEntityState = (
  entity_id: string,
  state: string,
  attributes: Record<string, unknown>,
  last_changed: Date = new Date()
): HAEntityState => {
  return {
    entity_id,
    state,
    attributes: { ...attributes },
    context: {
      id: `mock_${Math.random().toString(36).substr(2, 9)}`,
      parent_id: null,
      user_id: 'mock_user_1'
    },
    last_changed: last_changed.toISOString(),
    last_updated: last_changed.toISOString()
  };
};

/**
 * Mock command handler with latency simulation and validation
 */
export const mockEntityCommandHandler = jest.fn().mockImplementation(
  async (entity_id: string, command: string, data: Record<string, unknown>) => {
    // Simulate network latency (50-150ms)
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    // Validate entity exists
    if (!mockEntityStates[entity_id]) {
      throw new Error(`Entity ${entity_id} not found`);
    }

    // Simulate state updates based on commands
    const currentState = { ...mockEntityStates[entity_id] };
    const timestamp = new Date();

    switch (command) {
      case 'turn_on':
        mockEntityStates[entity_id] = createMockEntityState(
          entity_id,
          'on',
          {
            ...currentState.attributes,
            ...(data.brightness && { brightness: data.brightness }),
            last_command: command
          },
          timestamp
        );
        break;

      case 'turn_off':
        mockEntityStates[entity_id] = createMockEntityState(
          entity_id,
          'off',
          {
            ...currentState.attributes,
            last_command: command
          },
          timestamp
        );
        break;

      case 'set_temperature':
        if (currentState.attributes.hvac_modes?.includes(data.hvac_mode)) {
          mockEntityStates[entity_id] = createMockEntityState(
            entity_id,
            data.hvac_mode as string,
            {
              ...currentState.attributes,
              temperature: data.temperature,
              last_command: command
            },
            timestamp
          );
        } else {
          throw new Error(`Invalid HVAC mode: ${data.hvac_mode}`);
        }
        break;

      default:
        throw new Error(`Unsupported command: ${command}`);
    }

    return { success: true };
  }
);

// Mock the entity service for testing
jest.mock('../../src/services/entity', () => ({
  entityService: mockEntityCommandHandler
}));
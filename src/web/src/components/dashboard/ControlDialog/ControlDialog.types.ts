import { ReactNode } from 'react'; // v18.0.0
import { DialogProps } from '../../common/Dialog/Dialog.types';
import { EntityType } from '../../../types/entity.types';
import { HAEntityState } from '../../../backend/src/types/homeAssistant';

/**
 * Enumeration of available control types for different entity interactions
 * @enum {string}
 */
export enum ControlType {
  /** Toggle switch for binary states */
  TOGGLE = 'toggle',
  /** Slider for continuous values */
  SLIDER = 'slider',
  /** Select dropdown for predefined options */
  SELECT = 'select',
  /** Color picker for RGB/HSL values */
  COLOR = 'color',
  /** Numeric input for precise values */
  NUMBER = 'number'
}

/**
 * Type definition for control values that can be strings, numbers, booleans, or complex objects
 */
export type ControlValue = string | number | boolean | Record<string, any>;

/**
 * Type definition for control change event handler
 */
export type ControlChangeHandler = (name: string, value: ControlValue) => void;

/**
 * Type definition for form submission handler
 */
export type ControlSubmitHandler = (event: React.FormEvent) => Promise<void>;

/**
 * Interface for individual control option in select controls
 */
export interface ControlOption {
  /** Display label for the option */
  label: string;
  /** Value associated with the option */
  value: string | number;
}

/**
 * Interface for individual control configuration
 */
export interface ControlConfig {
  /** Unique identifier for the control */
  name: string;
  /** Display label for the control */
  label: string;
  /** Control type from ControlType enum */
  type: ControlType;
  /** Default value for the control */
  defaultValue: ControlValue;
  /** Available options for select controls */
  options?: ControlOption[];
  /** Minimum value for numeric/slider controls */
  min?: number;
  /** Maximum value for numeric/slider controls */
  max?: number;
  /** Step value for numeric/slider controls */
  step?: number;
  /** Whether the control is disabled */
  disabled?: boolean;
  /** Help text for the control */
  helpText?: string;
}

/**
 * Interface for entity-specific control configuration
 */
export interface EntityControlConfig {
  /** Type of entity being controlled */
  entityType: EntityType;
  /** Array of control configurations */
  controls: ControlConfig[];
  /** Optional custom validation rules */
  validation?: Record<string, (value: ControlValue) => string | null>;
}

/**
 * Interface for control dialog internal state
 */
export interface ControlDialogState {
  /** Loading state for async operations */
  loading: boolean;
  /** Error message if operation fails */
  error: string | null;
  /** Current values for all controls */
  controlValues: Record<string, ControlValue>;
  /** Validation errors for controls */
  validationErrors: Record<string, string>;
  /** Whether form has been touched */
  isDirty: boolean;
}

/**
 * Props interface for the ControlDialog component
 * Extends base DialogProps with entity-specific properties
 */
export interface ControlDialogProps extends Pick<DialogProps, 'isOpen' | 'onClose'> {
  /** Entity identifier */
  entityId: string;
  /** Entity type from EntityType enum */
  entityType: EntityType;
  /** Current entity state from Home Assistant */
  entityState: HAEntityState;
  /** Optional custom control configurations */
  customControls?: ControlConfig[];
  /** Optional custom header content */
  headerContent?: ReactNode;
  /** Optional custom footer content */
  footerContent?: ReactNode;
  /** Callback when controls are updated */
  onControlsUpdate?: (entityId: string, values: Record<string, ControlValue>) => Promise<void>;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Optional CSS class name */
  className?: string;
}
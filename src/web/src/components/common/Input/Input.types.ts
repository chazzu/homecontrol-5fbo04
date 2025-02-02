import { ChangeEvent, FocusEvent } from 'react'; // ^18.0.0

/**
 * Enumeration of available input size variants for consistent component sizing
 */
export enum InputSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

/**
 * Enumeration of available input style variants for theme consistency
 */
export enum InputVariant {
  OUTLINED = 'outlined',
  FILLED = 'filled'
}

/**
 * Type definition for allowed HTML input types to ensure type safety
 */
export type InputType = 
  | 'text'
  | 'password'
  | 'email'
  | 'number'
  | 'tel'
  | 'url';

/**
 * Interface defining the props for the Input component
 * Includes comprehensive type definitions for all props including ARIA attributes
 * for WCAG 2.1 Level AA compliance
 */
export interface InputProps {
  /** Unique identifier for the input element */
  id: string;
  
  /** Name attribute for form submission */
  name: string;
  
  /** Type of input field */
  type: InputType;
  
  /** Current value of the input field */
  value: string;
  
  /** Placeholder text shown when input is empty */
  placeholder: string;
  
  /** Label text for the input field */
  label: string;
  
  /** Error message to display when input validation fails */
  error?: string;
  
  /** Whether the input is disabled */
  disabled?: boolean;
  
  /** Whether the input is required */
  required?: boolean;
  
  /** Size variant of the input */
  size?: InputSize;
  
  /** Style variant of the input */
  variant?: InputVariant;
  
  /** Handler for input value changes */
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  
  /** Handler for input focus events */
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  
  /** Handler for input blur events */
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  
  /** Accessible label for screen readers */
  'aria-label': string;
  
  /** ID of the element that describes this input */
  'aria-describedby'?: string;
  
  /** Whether the input contains an invalid value */
  'aria-invalid'?: boolean;
}
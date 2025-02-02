// react version: ^18.0.0
import { ReactNode } from 'react';

/**
 * Enumeration of available loader sizes following Material Design principles
 * @enum {string}
 */
export enum LoaderSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

/**
 * Enumeration of available loader animation variants
 * @enum {string}
 */
export enum LoaderVariant {
  SPINNER = 'spinner',
  DOTS = 'dots'
}

/**
 * Interface defining the props for the Loader component
 * Compliant with WCAG 2.1 Level AA accessibility requirements
 * Supports theme-aware styling through CSS variables
 * 
 * @interface LoaderProps
 * @property {LoaderSize} size - The size variant of the loader
 * @property {LoaderVariant} variant - The animation style of the loader
 * @property {string} [color] - Optional custom color (supports CSS variables)
 * @property {string} [className] - Optional CSS class name for custom styling
 * @property {string} [ariaLabel] - Accessibility label for screen readers
 */
export interface LoaderProps {
  /** Size variant of the loader */
  size: LoaderSize;
  
  /** Animation variant of the loader */
  variant: LoaderVariant;
  
  /** Optional custom color that supports theme CSS variables */
  color?: string;
  
  /** Optional CSS class name for custom styling */
  className?: string;
  
  /** Accessibility label for screen readers (WCAG 2.1 AA) */
  ariaLabel?: string;
}
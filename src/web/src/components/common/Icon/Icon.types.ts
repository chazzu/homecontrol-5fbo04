// React ^18.0.0 - Required for component props and event handler types
import { MouseEvent } from 'react';

/**
 * Defines the categories of icons available in the system for visual hierarchy.
 * Used to maintain consistent icon usage and categorization throughout the application.
 */
export enum IconType {
  DEVICE = 'device',   // Icons representing smart home devices
  UI = 'ui',          // Icons for user interface elements
  STATUS = 'status'   // Icons indicating states or statuses
}

/**
 * Defines the available size variants for icons ensuring consistent scaling.
 * Maintains visual consistency across the application through standardized icon sizes.
 */
export enum IconSize {
  SMALL = 'small',    // Small icon variant (e.g., for dense UIs)
  MEDIUM = 'medium',  // Medium icon variant (default size)
  LARGE = 'large'     // Large icon variant (e.g., for featured elements)
}

/**
 * Props interface for the Icon component with comprehensive theme and accessibility support.
 * Ensures type safety and proper integration with the application's design system.
 */
export interface IconProps {
  /** Identifier for the specific icon to render from the icon system */
  name: string;

  /** Category of the icon for visual hierarchy (device, UI, or status) */
  type: IconType;

  /** Size variant of the icon for consistent scaling */
  size: IconSize;

  /** Optional color override supporting theme integration */
  color?: string;

  /** Optional CSS class for additional styling customization */
  className?: string;

  /** Optional click handler with proper event typing */
  onClick?: (event: MouseEvent<SVGSVGElement>) => void;

  /** Accessible title for the icon */
  title?: string;

  /** ARIA role for accessibility */
  role?: string;

  /** ARIA label for screen readers */
  ariaLabel?: string;

  /** Optional theme variant for light/dark mode support */
  themeVariant?: string;
}
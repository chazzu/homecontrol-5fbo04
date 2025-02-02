import { ReactNode } from 'react'; // v18.0.0

/**
 * Enumeration defining available dialog size variants for responsive layouts
 * @enum {string}
 */
export enum DialogSize {
  /** Small dialog suitable for simple messages or confirmations */
  SMALL = 'small',
  /** Medium dialog for standard forms and content */
  MEDIUM = 'medium',
  /** Large dialog for complex forms or data displays */
  LARGE = 'large',
  /** Full screen dialog for immersive experiences */
  FULL_SCREEN = 'fullscreen'
}

/**
 * Main interface for the Dialog component with accessibility and interaction props
 * Compliant with WCAG 2.1 Level AA requirements
 * @interface
 */
export interface DialogProps {
  /** Controls the visibility state of the dialog */
  isOpen: boolean;
  /** Callback function triggered when the dialog should close */
  onClose: () => void;
  /** Title text displayed in the dialog header */
  title: string;
  /** Content to be rendered within the dialog */
  children: ReactNode;
  /** Controls the size variant of the dialog */
  size: DialogSize;
  /** Whether to show the close button in the header */
  showCloseButton: boolean;
  /** Whether clicking the overlay should close the dialog */
  closeOnOverlayClick: boolean;
  /** Whether pressing the Escape key should close the dialog */
  closeOnEscapeKey: boolean;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Accessible label for screen readers (ARIA) */
  ariaLabel: string;
}

/**
 * Interface for the Dialog header subcomponent
 * Contains title and close button functionality
 * @interface
 */
export interface DialogHeaderProps {
  /** Title text displayed in the header */
  title: string;
  /** Whether to show the close button */
  showCloseButton: boolean;
  /** Callback function triggered when close button is clicked */
  onClose: () => void;
  /** Optional CSS class name for custom styling */
  className?: string;
}

/**
 * Interface for the Dialog content subcomponent
 * Wrapper for main dialog content
 * @interface
 */
export interface DialogContentProps {
  /** Content to be rendered within the dialog body */
  children: ReactNode;
  /** Optional CSS class name for custom styling */
  className?: string;
}

/**
 * Interface for the Dialog footer subcomponent
 * Contains action buttons and additional controls
 * @interface
 */
export interface DialogFooterProps {
  /** Content to be rendered within the footer */
  children: ReactNode;
  /** Optional CSS class name for custom styling */
  className?: string;
}
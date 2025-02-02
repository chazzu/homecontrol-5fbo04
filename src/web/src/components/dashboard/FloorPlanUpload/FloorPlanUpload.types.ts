/**
 * @file FloorPlanUpload Type Definitions
 * @version 1.0.0
 * 
 * Comprehensive TypeScript type definitions for the FloorPlanUpload component,
 * providing strict type safety for floor plan upload functionality.
 */

import { ReactNode } from 'react'; // v18.0.0
import { FloorPlan } from '../../../types/floorPlan.types';

/**
 * Props interface for the FloorPlanUpload component
 */
export interface FloorPlanUploadProps {
  /** Callback function for successful upload */
  onUpload: (data: FloorPlanUploadData) => Promise<void>;
  /** Callback function for upload cancellation */
  onCancel: () => void;
  /** Dialog open state */
  isOpen: boolean;
  /** Loading state indicator */
  loading: boolean;
  /** Error message if upload fails */
  error: string | null;
  /** Optional progress tracking callback */
  onProgress?: UploadProgressCallback;
  /** Optional custom dialog content */
  children?: ReactNode;
}

/**
 * Interface for floor plan upload form data
 */
export interface FloorPlanUploadData {
  /** Display name for the floor plan */
  name: string;
  /** SVG data as base64 encoded string */
  svgData: string;
  /** Floor plan dimensions */
  dimensions: Dimensions;
  /** Scale factor (pixels per meter) */
  scale: number;
  /** Display order preference */
  order: number;
}

/**
 * Interface for floor plan validation results
 */
export interface FloorPlanValidationResult {
  /** Validation success indicator */
  isValid: boolean;
  /** Array of validation errors */
  errors: ValidationError[];
  /** Array of validation warnings */
  warnings: ValidationWarning[];
  /** Extracted dimensions if valid */
  dimensions: Dimensions | null;
  /** Validation timestamp */
  timestamp: number;
  /** Validation context information */
  context: ValidationContext;
}

/**
 * Interface for validation errors
 */
export interface ValidationError {
  /** Error code for identification */
  code: ValidationErrorCode;
  /** Human-readable error message */
  message: string;
  /** Error severity level */
  severity: ValidationSeverity;
}

/**
 * Interface for validation warnings
 */
export interface ValidationWarning {
  /** Warning code for identification */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Warning timestamp */
  timestamp: number;
}

/**
 * Interface for validation context
 */
export interface ValidationContext {
  /** Original file name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** File MIME type */
  mimeType: string;
}

/**
 * Type definition for file validation function
 */
export type FileValidationFunction = (
  file: File,
  context?: ValidationContext
) => Promise<FloorPlanValidationResult>;

/**
 * Type definition for SVG processing function
 */
export type SVGProcessingFunction = (
  svgData: string,
  onProgress?: UploadProgressCallback
) => Promise<string>;

/**
 * Type definition for upload progress tracking
 */
export type UploadProgressCallback = (
  progress: number,
  stage: UploadStage
) => void;

/**
 * Enumeration of possible validation error codes
 */
export enum ValidationErrorCode {
  INVALID_FORMAT = 'INVALID_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_DIMENSIONS = 'INVALID_DIMENSIONS',
  UNSUPPORTED_SVG_FEATURES = 'UNSUPPORTED_SVG_FEATURES',
  SECURITY_RISK_DETECTED = 'SECURITY_RISK_DETECTED'
}

/**
 * Enumeration of validation message severity levels
 */
export enum ValidationSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

/**
 * Enumeration of upload process stages
 */
export enum UploadStage {
  VALIDATION = 'VALIDATION',
  PROCESSING = 'PROCESSING',
  OPTIMIZATION = 'OPTIMIZATION',
  STORAGE = 'STORAGE'
}

/**
 * Interface for dimensions with aspect ratio
 */
interface Dimensions {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Aspect ratio (width/height) */
  aspectRatio: number;
}

/**
 * Readonly record of validation error messages
 */
export const VALIDATION_ERROR_MESSAGES: Readonly<Record<ValidationErrorCode, string>> = {
  [ValidationErrorCode.INVALID_FORMAT]: 'Invalid file format. Only SVG files are supported.',
  [ValidationErrorCode.FILE_TOO_LARGE]: 'File size exceeds maximum limit of 2MB.',
  [ValidationErrorCode.INVALID_DIMENSIONS]: 'Invalid floor plan dimensions.',
  [ValidationErrorCode.UNSUPPORTED_SVG_FEATURES]: 'SVG contains unsupported features.',
  [ValidationErrorCode.SECURITY_RISK_DETECTED]: 'Security risk detected in SVG file.'
} as const;
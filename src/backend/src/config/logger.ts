import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LOGGING } from './constants';
import type { ProcessEnv } from '../types/environment';

// Base log format combining timestamp, error stacks, and string interpolation
const LOG_FORMAT = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
);

// Production uses JSON format for structured logging
const PROD_FORMAT = winston.format.combine(
  LOG_FORMAT,
  winston.format.json()
);

// Development uses colorized simple format for readability
const DEV_FORMAT = winston.format.combine(
  LOG_FORMAT,
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, metadata, stack }) => {
    let output = `${timestamp} ${level}: ${message}`;
    if (Object.keys(metadata).length > 0) {
      output += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
    }
    if (stack) {
      output += `\nStack: ${stack}`;
    }
    return output;
  })
);

/**
 * Creates and configures a console transport with environment-specific formatting
 */
const createConsoleTransport = (): winston.transports.ConsoleTransportInstance => {
  return new winston.transports.Console({
    level: process.env.LOG_LEVEL || LOGGING.LEVEL,
    format: process.env.NODE_ENV === 'production' ? PROD_FORMAT : DEV_FORMAT,
    handleExceptions: true,
    handleRejections: true
  });
};

/**
 * Creates and configures a rotating file transport for persistent logging
 */
const createFileTransport = (): DailyRotateFile => {
  return new DailyRotateFile({
    level: process.env.LOG_LEVEL || LOGGING.LEVEL,
    filename: process.env.LOG_FILE || LOGGING.FILE_PATH,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '50m',
    maxFiles: '14d',
    format: PROD_FORMAT,
    handleExceptions: true,
    handleRejections: true,
    // Custom options for better error handling and performance
    options: { flags: 'a' },
    auditFile: 'audit.json'
  });
};

/**
 * Configured Winston logger instance with multiple transports and formats.
 * Supports different log levels: error, warn, info, debug
 * Handles both synchronous and asynchronous logging
 * Preserves error stack traces
 * Implements log rotation and compression
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || LOGGING.LEVEL,
  defaultMeta: { service: 'smart-home-dashboard' },
  transports: [
    createConsoleTransport(),
    ...(process.env.NODE_ENV === 'production' ? [createFileTransport()] : [])
  ],
  // Exit on error: false to prevent process termination on uncaught exceptions
  exitOnError: false,
  // Silent mode for test environment
  silent: process.env.NODE_ENV === 'test'
});

// Export individual log level methods for convenience
export const error = logger.error.bind(logger);
export const warn = logger.warn.bind(logger);
export const info = logger.info.bind(logger);
export const debug = logger.debug.bind(logger);

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Give logger time to write before exiting
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});
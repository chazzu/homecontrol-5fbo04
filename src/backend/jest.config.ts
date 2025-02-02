import type { Config } from '@jest/types'; // v29.0.0

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directories for tests and source files
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Configure module name mapping to match tsconfig path aliases
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@config/(.*)': '<rootDir>/src/config/$1',
    '@core/(.*)': '<rootDir>/src/core/$1',
    '@api/(.*)': '<rootDir>/src/api/$1',
    '@database/(.*)': '<rootDir>/src/database/$1',
    '@types/(.*)': '<rootDir>/src/types/$1',
    '@utils/(.*)': '<rootDir>/src/utils/$1'
  },

  // Enable code coverage collection
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],

  // Set coverage thresholds to ensure high test coverage
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Configure test file patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],

  // Specify supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Enable verbose output for detailed test results
  verbose: true,

  // Set test timeout to 10 seconds
  testTimeout: 10000,

  // Reset mocks between tests
  clearMocks: true,
  restoreMocks: true
};

export default config;
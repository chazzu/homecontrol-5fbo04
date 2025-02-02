import { useState, useEffect, useCallback } from 'react'; // v18.0+
import { StorageService, StorageError } from '../services/storage';
import { STORAGE_KEYS } from '../config/constants';

/**
 * Configuration options for the useLocalStorage hook
 */
export interface UseLocalStorageOptions {
  /** Enable cross-tab synchronization */
  sync?: boolean;
  /** Enable schema validation */
  validate?: boolean;
  /** Custom quota limit in bytes */
  quotaLimit?: number;
  /** Enable data compression */
  enableCompression?: boolean;
  /** Enable data encryption */
  enableEncryption?: boolean;
}

/**
 * Default options for the useLocalStorage hook
 */
const DEFAULT_OPTIONS: UseLocalStorageOptions = {
  sync: true,
  validate: true,
  enableCompression: false,
  enableEncryption: false,
};

/**
 * A custom React hook for managing localStorage with type safety, validation,
 * and cross-tab synchronization.
 * 
 * @template T - Type of the stored value
 * @param {string} key - Storage key from STORAGE_KEYS
 * @param {T} initialValue - Initial value if none exists in storage
 * @param {UseLocalStorageOptions} options - Configuration options
 * @returns {[T, (value: T) => void, () => void, Error | null]} Tuple containing:
 * - Current value
 * - Setter function
 * - Remove function
 * - Error state
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions = DEFAULT_OPTIONS
): [T, (value: T) => void, () => void, Error | null] {
  // Validate storage key
  if (!Object.values(STORAGE_KEYS).includes(key)) {
    throw new Error(`Invalid storage key: ${key}`);
  }

  // Initialize StorageService instance
  const storage = new StorageService();

  // Initialize state and error
  const [value, setValue] = useState<T>(() => {
    try {
      const storedValue = storage.getItem<T>(key);
      return storedValue !== null ? storedValue : initialValue;
    } catch (error) {
      console.error(`Error initializing storage for key ${key}:`, error);
      return initialValue;
    }
  });

  const [error, setError] = useState<Error | null>(null);

  /**
   * Memoized setter function with validation and error handling
   */
  const setStoredValue = useCallback((newValue: T) => {
    try {
      // Handle function updates
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue;

      // Update React state
      setValue(valueToStore);

      // Update localStorage
      storage.setItem(key, valueToStore);

      // Clear any previous errors
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to store value'));
      
      // Log detailed error information
      if (error instanceof StorageError) {
        console.error(`Storage error for key ${key}:`, {
          code: error.code,
          message: error.message,
          value: error.value
        });
      }
    }
  }, [key, value]);

  /**
   * Memoized remove function
   */
  const removeStoredValue = useCallback(() => {
    try {
      storage.removeItem(key);
      setValue(initialValue);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to remove value'));
    }
  }, [key, initialValue]);

  /**
   * Effect for handling storage events (cross-tab synchronization)
   */
  useEffect(() => {
    if (!options.sync) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const newValue = JSON.parse(event.newValue) as T;
          setValue(newValue);
          setError(null);
        } catch (error) {
          setError(new Error('Failed to sync value across tabs'));
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, options.sync]);

  /**
   * Effect for handling quota exceeded errors
   */
  useEffect(() => {
    if (error instanceof StorageError && error.code === 'STOR_001') {
      // Attempt to free up space by removing temporary data
      try {
        storage.removeItem(STORAGE_KEYS.entityStates);
        setError(null);
      } catch (cleanupError) {
        console.error('Failed to cleanup storage:', cleanupError);
      }
    }
  }, [error]);

  /**
   * Effect for periodic validation of stored data
   */
  useEffect(() => {
    if (!options.validate) return;

    const validateData = () => {
      try {
        const storedValue = storage.getItem<T>(key);
        if (storedValue !== null) {
          setValue(storedValue);
        }
      } catch (error) {
        setError(error instanceof Error ? error : new Error('Validation failed'));
      }
    };

    // Validate on mount and every 5 minutes
    validateData();
    const interval = setInterval(validateData, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [key, options.validate]);

  return [value, setStoredValue, removeStoredValue, error];
}

export default useLocalStorage;
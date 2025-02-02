import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'; // v1.4.0
import { AuthState } from '../types/auth.types';
import { API_VERSION, AUTH_TIMEOUT, ERROR_CODES, PERFORMANCE_THRESHOLDS } from '../config/constants';

/**
 * Interface for request queue item
 */
interface QueueItem {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  config: AxiosRequestConfig;
}

/**
 * Interface for cached response
 */
interface CachedResponse {
  data: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * Core API service class providing enhanced HTTP request functionality
 * with comprehensive security, performance, and reliability features
 */
export class ApiService {
  private axiosInstance: AxiosInstance;
  private authToken: string | null = null;
  private refreshToken: string | null = null;
  private requestQueue: QueueItem[] = [];
  private requestCache: Map<string, CachedResponse> = new Map();
  private isRefreshing: boolean = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  private readonly DEFAULT_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-API-Version': API_VERSION
  };

  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly CACHE_MAX_AGE = 300000;  // 5 minutes
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: this.REQUEST_TIMEOUT,
      headers: this.DEFAULT_HEADERS
    });

    this.setupInterceptors();
  }

  /**
   * Configure request and response interceptors for enhanced functionality
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const startTime = performance.now();
        config.metadata = { startTime };

        // Add auth header if token exists
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logPerformanceMetrics(response);
        return response;
      },
      async (error: AxiosError) => {
        return this.handleRequestError(error);
      }
    );
  }

  /**
   * Set authentication tokens with enhanced security
   */
  public setAuthToken(token: string, refresh?: string): void {
    if (!this.isValidToken(token)) {
      throw new Error(ERROR_CODES.AUTH.INVALID_TOKEN);
    }

    this.authToken = token;
    this.refreshToken = refresh || null;
    this.axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  /**
   * Clear authentication tokens and reset headers
   */
  public clearAuthToken(): void {
    this.authToken = null;
    this.refreshToken = null;
    delete this.axiosInstance.defaults.headers.common.Authorization;
  }

  /**
   * Perform GET request with caching and retry logic
   */
  public async get<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    const cacheKey = this.generateCacheKey(url, config);
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    const response = await this.executeRequest<T>('GET', url, config);
    this.cacheResponse(cacheKey, response);
    return response;
  }

  /**
   * Perform POST request with retry logic
   */
  public async post<T>(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<T> {
    return this.executeRequest<T>('POST', url, { ...config, data });
  }

  /**
   * Perform PUT request with retry logic
   */
  public async put<T>(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<T> {
    return this.executeRequest<T>('PUT', url, { ...config, data });
  }

  /**
   * Perform DELETE request with retry logic
   */
  public async delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.executeRequest<T>('DELETE', url, config);
  }

  /**
   * Execute request with retry logic and queue management
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    config: AxiosRequestConfig,
    retryCount = 0
  ): Promise<T> {
    try {
      const response = await this.axiosInstance.request<T>({
        method,
        url,
        ...config
      });
      return response.data;
    } catch (error) {
      if (retryCount < this.MAX_RETRY_ATTEMPTS) {
        await this.delay(Math.pow(2, retryCount) * 1000);
        return this.executeRequest<T>(method, url, config, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Handle request errors with token refresh logic
   */
  private async handleRequestError(error: AxiosError): Promise<any> {
    if (!error.response) {
      throw error;
    }

    const { status, config } = error.response;

    if (status === 401 && this.refreshToken && !this.isRefreshing) {
      return this.handleTokenRefresh(config);
    }

    // Handle rate limiting
    if (status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      await this.delay(parseInt(retryAfter, 10) * 1000);
      return this.axiosInstance.request(config);
    }

    throw error;
  }

  /**
   * Handle token refresh process
   */
  private async handleTokenRefresh(failedConfig: AxiosRequestConfig): Promise<any> {
    if (!this.refreshToken) {
      throw new Error(ERROR_CODES.AUTH.TOKEN_EXPIRED);
    }

    try {
      this.isRefreshing = true;
      const response = await this.axiosInstance.post('/auth/refresh', {
        refresh_token: this.refreshToken
      });

      const { token, refresh_token } = response.data;
      this.setAuthToken(token, refresh_token);
      
      // Retry failed requests
      const retryRequests = this.refreshSubscribers;
      this.refreshSubscribers = [];
      retryRequests.forEach(callback => callback(token));

      return this.axiosInstance.request(failedConfig);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(url: string, config: AxiosRequestConfig): string {
    return `${url}-${JSON.stringify(config.params || {})}`;
  }

  /**
   * Get cached response if valid
   */
  private getCachedResponse(key: string): any | null {
    const cached = this.requestCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    this.requestCache.delete(key);
    return null;
  }

  /**
   * Cache response with expiration
   */
  private cacheResponse(key: string, data: any): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.CACHE_MAX_AGE
    });
  }

  /**
   * Log performance metrics for monitoring
   */
  private logPerformanceMetrics(response: AxiosResponse): void {
    const { startTime } = response.config.metadata || {};
    if (startTime) {
      const duration = performance.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLDS.maxResponseTime) {
        console.warn(`Request to ${response.config.url} took ${duration}ms`);
      }
    }
  }

  /**
   * Validate token format
   */
  private isValidToken(token: string): boolean {
    return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(token);
  }

  /**
   * Utility method for delayed execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const apiService = new ApiService();
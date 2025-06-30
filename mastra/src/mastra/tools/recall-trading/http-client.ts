import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

// ============================================================================
// HTTP CLIENT SETUP
// ============================================================================

export const http: AxiosInstance = axios.create({
  headers: {
    Authorization: `Bearer ${process.env.RECALL_API_KEY!}`,
    "Content-Type": "application/json",
  },
});

// Add exponential backoff retry for 429/5xx errors
axiosRetry(http, {
  retries: 5,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429
    );
  },
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert amount to base units (applies decimals)
 */
export function toBaseUnits(amount: number, decimals: number): string {
  const scaled = Math.floor(amount * Math.pow(10, decimals));
  return scaled.toString();
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  status: string,
  message: string,
  additionalData?: any
) {
  return {
    status,
    message,
    ...additionalData,
  };
}

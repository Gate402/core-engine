// ============ Response Types ============

export interface GatewayOverviewResponse {
  /** Total number of requests */
  totalRequests: number;
  /** Number of successful payments */
  successfulPayments: number;
  /** Number of failed payments */
  failedPayments: number;
  /** Total revenue earned (in smallest token unit) */
  totalRevenue: string;
  /** Unique payers count */
  uniquePayers: number;
  /** Average latency in ms */
  avgLatencyMs: number | null;
  /** Conversion rate (paid / total requests) */
  conversionRate: number;
}

export interface TopPayerResponse {
  /** Wallet address */
  wallet: string;
  /** Total amount spent (in smallest token unit) */
  totalSpent: string;
  /** Number of requests made */
  requestCount: number;
  /** Last request timestamp */
  lastRequestAt: Date;
}

export interface RequestTimelineResponse {
  /** Time bucket (ISO date string) */
  timestamp: string;
  /** Total requests in this bucket */
  totalRequests: number;
  /** Paid requests in this bucket */
  paidRequests: number;
  /** Failed requests in this bucket */
  failedRequests: number;
}

export interface RevenueTimelineResponse {
  /** Time bucket (ISO date string) */
  timestamp: string;
  /** Revenue in this bucket (in smallest token unit) */
  revenue: string;
  /** Number of successful payments */
  paymentCount: number;
}

export interface RouteAnalyticsResponse {
  /** API route path */
  path: string;
  /** HTTP method */
  method: string;
  /** Total requests to this route */
  totalRequests: number;
  /** Paid requests to this route */
  paidRequests: number;
  /** Average latency in ms */
  avgLatencyMs: number | null;
  /** Revenue from this route (in smallest token unit) */
  revenue: string;
}

export interface ErrorAnalyticsResponse {
  /** Error type */
  errorType: string;
  /** Error count */
  count: number;
  /** Sample error messages */
  sampleMessages: string[];
}

export interface ConversionFunnelResponse {
  /** Total requests */
  totalRequests: number;
  /** Requests that returned 402 (payment required) */
  paymentRequiredCount: number;
  /** Requests with payment header provided */
  paymentAttemptCount: number;
  /** Requests with valid payment */
  validPaymentCount: number;
  /** Successfully settled payments */
  settledPaymentCount: number;
  /** Conversion rates */
  rates: {
    attemptRate: number; // paymentAttempt / paymentRequired
    validationRate: number; // validPayment / paymentAttempt
    settlementRate: number; // settledPayment / validPayment
    overallRate: number; // settledPayment / paymentRequired
  };
}

// Query params
export interface AnalyticsQueryParams {
  gatewayId: string;
  startDate?: string;
  endDate?: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
}


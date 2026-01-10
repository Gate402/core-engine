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

// ============ User-Level Analytics (Dashboard) ============

export interface UserOverviewResponse {
  /** Total number of gateways */
  totalGateways: number;
  /** Total requests across all gateways */
  totalRequests: number;
  /** Number of successful payments */
  successfulPayments: number;
  /** Total revenue earned across all gateways (in smallest token unit) */
  totalRevenue: string;
  /** Unique payers count across all gateways */
  uniquePayers: number;
  /** Average latency in ms across all gateways */
  avgLatencyMs: number | null;
  /** Per-gateway breakdown */
  gatewayBreakdown: {
    gatewayId: string;
    subdomain: string;
    totalRequests: number;
    totalRevenue: string;
  }[];
}

export interface UserRevenueTimelineResponse {
  /** Time bucket (ISO date string) */
  timestamp: string;
  /** Revenue in this bucket (in smallest token unit) */
  revenue: string;
  /** Number of successful payments */
  paymentCount: number;
}

export interface UserRequestsTimelineResponse {
  /** Time bucket (ISO date string) */
  timestamp: string;
  /** Total requests in this bucket */
  totalRequests: number;
  /** Paid requests in this bucket */
  paidRequests: number;
  /** Failed requests in this bucket */
  failedRequests: number;
}

// Query params
export interface AnalyticsQueryParams {
  gatewayId: string;
  startDate?: string;
  endDate?: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
}

export interface LatestTransactionResponse {
  /** Transaction ID */
  id: string;
  /** Gateway ID */
  gatewayId: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** HTTP status code */
  statusCode: number;
  /** Client wallet address */
  clientWallet: string | null;
  /** Client IP address */
  clientIp: string | null;
  /** Payment amount (in smallest token unit) */
  paymentAmount: string | null;
  /** Payment token symbol */
  paymentToken: string | null;
  /** Payment network */
  paymentNetwork: string | null;
  /** Settlement transaction hash */
  settlementTxHash: string | null;
  /** Settlement status */
  settlementStatus: string | null;
  /** Request duration in ms */
  durationMs: number | null;
  /** Payment verification time in ms */
  paymentVerifyMs: number | null;
  /** Settlement time in ms */
  settlementMs: number | null;
  /** Origin latency in ms */
  originLatencyMs: number | null;
  /** Error type if any */
  errorType: string | null;
  /** Error message if any */
  errorMessage: string | null;
  /** Request timestamp */
  createdAt: string;
}

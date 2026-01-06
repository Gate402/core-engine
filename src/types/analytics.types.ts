// ============ Response Types ============

export interface GatewayOverviewResponse {
  /** Total number of requests */
  totalRequests: any;
  /** Number of successful payments */
  successfulPayments: any;
  /** Total revenue earned */
  totalRevenue: any;
}

export interface TopPayerResponse {
  /** Wallet address */
  wallet: string;
  /** Total amount spent */
  totalSpent: number | null;
}

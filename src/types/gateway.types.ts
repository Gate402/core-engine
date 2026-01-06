// ============ Request Types ============

export interface QuickCreateGatewayRequest {
  /** Target origin URL to proxy to */
  originUrl: string;
  /** Price per request in USD (e.g., 0.001) */
  pricePerRequest: number;
  /** EVM address to receive payments */
  evmAddress: string;
}

export interface CreateGatewayRequest {
  /** Target origin URL to proxy to */
  originUrl: string;
  /** Price per request in USD (e.g., 0.001) */
  pricePerRequest: number;
  /** List of accepted payment networks (e.g., eip155:84532) */
  acceptedNetworks: string[];
  /** Subdomain for the gateway (e.g., "myapi") */
  subdomain: string;
  /** EVM address to receive payments */
  evmAddress: string;
  /** Optional custom domain */
  customDomain?: string;
  /** Payment scheme (exact, flexible) */
  paymentScheme?: string;
  /** Primary payment network */
  paymentNetwork?: string;
}

export interface UpdateGatewayRequest {
  /** Target origin URL to proxy to */
  originUrl?: string;
  /** Price per request in USD */
  defaultPricePerRequest?: number;
  /** Gateway status (active, paused, deleted) */
  status?: string;
  /** Custom domain */
  customDomain?: string | null;
  /** Payment scheme */
  paymentScheme?: string;
  /** Primary payment network */
  paymentNetwork?: string;
  /** EVM address to receive payments */
  evmAddress?: string;
}

// ============ Response Types ============

export interface GatewayResponse {
  id: string;
  subdomain: string;
  originUrl: string;
  defaultPricePerRequest: number;
  acceptedNetworks: string[];
  secretToken: string;
  status: string;
  customDomain: string | null;
  paymentScheme: string;
  paymentNetwork: string;
  evmAddress: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuickCreateGatewayResponse extends GatewayResponse {
  /** Full gateway URL */
  gatewayUrl: string;
  /** Local test URL */
  testUrl: string;
  /** Payment network used */
  network: string;
  /** Whether using testnet */
  isTestnet: boolean;
}

export interface GatewayListResponse {
  gateways: GatewayResponse[];
}

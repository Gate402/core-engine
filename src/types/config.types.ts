// ============ Response Types ============

export interface ChainResponse {
  id: string;
  name: string;
  nativeCurrency: string;
  rpcUrl: string | null;
  blockExplorer: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenResponse {
  id: string;
  chainId: string;
  symbol: string;
  address: string;
  decimals: number;
  name: string | null;
  version: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChainWithTokensResponse extends ChainResponse {
  tokens: TokenResponse[];
}

export interface TokenWithChainResponse extends TokenResponse {
  chain: ChainResponse;
}

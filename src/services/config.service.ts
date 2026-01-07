import { getPrismaClient } from '../config/database';

/**
 * Config Service
 *
 * Provides configuration data for the application including:
 * - Supported chains (blockchain networks)
 * - Supported tokens per chain
 */
export class ConfigService {
  private prisma = getPrismaClient();

  /**
   * Get list of all supported chains
   * @returns Array of chain configurations
   */
  async getChains() {
    return this.prisma.chain.findMany({
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get a specific chain by ID
   * @param chainId - Chain ID (e.g., "eip155:84532")
   * @returns Chain configuration or null if not found
   */
  async getChainById(chainId: string) {
    return this.prisma.chain.findUnique({
      where: { id: chainId },
      include: { tokens: true },
    });
  }

  /**
   * Get list of all supported tokens across all chains
   * @returns Array of token configurations
   */
  async getAllTokens() {
    return this.prisma.token.findMany({
      include: { chain: true },
      orderBy: [{ chainId: 'asc' }, { symbol: 'asc' }],
    });
  }

  /**
   * Get tokens for a specific chain
   * @param chainId - Chain ID (e.g., "eip155:84532")
   * @returns Array of token configurations for the specified chain
   */
  async getTokensByChain(chainId: string) {
    return this.prisma.token.findMany({
      where: { chainId },
      orderBy: { symbol: 'asc' },
    });
  }

  /**
   * Get a specific token by ID
   * @param tokenId - Token UUID
   * @returns Token configuration or null if not found
   */
  async getTokenById(tokenId: string) {
    return this.prisma.token.findUnique({
      where: { id: tokenId },
      include: { chain: true },
    });
  }

  /**
   * Get a token by chain and symbol
   * @param chainId - Chain ID (e.g., "eip155:84532")
   * @param symbol - Token symbol (e.g., "usdc")
   * @returns Token configuration or null if not found
   */
  async getTokenByChainAndSymbol(chainId: string, symbol: string) {
    return this.prisma.token.findUnique({
      where: {
        chainId_symbol: {
          chainId,
          symbol: symbol.toLowerCase(),
        },
      },
      include: { chain: true },
    });
  }

  /**
   * Get chains with their tokens
   * @returns Array of chains with nested token arrays
   */
  async getChainsWithTokens() {
    return this.prisma.chain.findMany({
      include: { tokens: true },
      orderBy: { id: 'asc' },
    });
  }
}

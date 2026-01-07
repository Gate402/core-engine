import { Controller, Get, Path, Response, Route, Tags } from 'tsoa';
import { ConfigService } from '../services/config.service';
import type {
  ChainResponse,
  ChainWithTokensResponse,
  TokenResponse,
  TokenWithChainResponse,
} from '../types/config.types';
import type { ErrorResponse } from '../types/auth.types';

@Route('config')
@Tags('Configuration')
export class ConfigTsoaController extends Controller {
  private configService = new ConfigService();

  /**
   * Get list of all supported blockchain networks
   * @summary List Chains
   */
  @Get('chains')
  @Response<ErrorResponse>(500, 'Internal Server Error')
  public async getChains(): Promise<ChainResponse[]> {
    return this.configService.getChains();
  }

  /**
   * Get details of a specific chain by ID
   * @summary Get Chain
   */
  @Get('chains/{chainId}')
  @Response<ErrorResponse>(404, 'Not Found')
  @Response<ErrorResponse>(500, 'Internal Server Error')
  public async getChainById(@Path() chainId: string): Promise<ChainWithTokensResponse> {
    const chain = await this.configService.getChainById(chainId);
    if (!chain) {
      this.setStatus(404);
      throw new Error(`Chain with ID ${chainId} not found`);
    }
    return chain;
  }

  /**
   * Get list of all supported chains with their tokens
   * @summary List Chains With Tokens
   */
  @Get('chains-with-tokens')
  @Response<ErrorResponse>(500, 'Internal Server Error')
  public async getChainsWithTokens(): Promise<ChainWithTokensResponse[]> {
    return this.configService.getChainsWithTokens();
  }

  /**
   * Get list of all supported tokens across all chains
   * @summary List All Tokens
   */
  @Get('tokens')
  @Response<ErrorResponse>(500, 'Internal Server Error')
  public async getAllTokens(): Promise<TokenWithChainResponse[]> {
    return this.configService.getAllTokens();
  }

  /**
   * Get tokens for a specific chain
   * @summary List Tokens by Chain
   */
  @Get('chains/{chainId}/tokens')
  @Response<ErrorResponse>(404, 'Not Found')
  @Response<ErrorResponse>(500, 'Internal Server Error')
  public async getTokensByChain(@Path() chainId: string): Promise<TokenResponse[]> {
    // Verify chain exists
    const chain = await this.configService.getChainById(chainId);
    if (!chain) {
      this.setStatus(404);
      throw new Error(`Chain with ID ${chainId} not found`);
    }

    return this.configService.getTokensByChain(chainId);
  }

  /**
   * Get a specific token by ID
   * @summary Get Token
   */
  @Get('tokens/{tokenId}')
  @Response<ErrorResponse>(404, 'Not Found')
  @Response<ErrorResponse>(500, 'Internal Server Error')
  public async getTokenById(@Path() tokenId: string): Promise<TokenWithChainResponse> {
    const token = await this.configService.getTokenById(tokenId);
    if (!token) {
      this.setStatus(404);
      throw new Error(`Token with ID ${tokenId} not found`);
    }
    return token;
  }

  /**
   * Get a token by chain and symbol
   * @summary Get Token by Chain and Symbol
   */
  @Get('chains/{chainId}/tokens/{symbol}')
  @Response<ErrorResponse>(404, 'Not Found')
  @Response<ErrorResponse>(500, 'Internal Server Error')
  public async getTokenByChainAndSymbol(
    @Path() chainId: string,
    @Path() symbol: string,
  ): Promise<TokenWithChainResponse> {
    const token = await this.configService.getTokenByChainAndSymbol(chainId, symbol);
    if (!token) {
      this.setStatus(404);
      throw new Error(`Token ${symbol} not found on chain ${chainId}`);
    }
    return token;
  }
}

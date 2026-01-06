import { x402ResourceServer, HTTPFacilitatorClient, ResourceConfig } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import type { PaymentRequirements, PaymentRequired, SettleResponse } from '@x402/core/types';
import { PrismaClient } from '@prisma/client';

/**
 * x402 Payment Service
 *
 * Manages x402 resource server and facilitator client for payment verification.
 * Handles building payment requirements, verifying payments through the facilitator,
 * and settling payments on-chain.
 */
export class X402Service {
  private facilitatorClient: HTTPFacilitatorClient;
  private resourceServer: x402ResourceServer;
  private requirementsCache: Map<string, PaymentRequirements>;
  private initialized: boolean = false;
  private prisma: PrismaClient;

  constructor() {
    const facilitatorUrl = process.env.FACILITATOR_URL || 'https://x402.org/facilitator';

    console.log(`🔗 Initializing x402 with facilitator: ${facilitatorUrl}`);

    this.facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
    this.resourceServer = new x402ResourceServer(this.facilitatorClient);
    this.requirementsCache = new Map();
    this.prisma = new PrismaClient();
  }

  /**
   * Initialize the resource server by syncing with facilitator
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const chains = await this.prisma.chain.findMany();
      for (const chain of chains) {
        this.resourceServer.register(chain.id as `${string}:${string}`, new ExactEvmScheme());
      }
      await this.resourceServer.initialize();
      this.initialized = true;
      console.log('✅ x402 resource server initialized');
    } catch (error) {
      console.error('❌ Failed to initialize x402 resource server:', error);
      throw error;
    }
  }

  /**
   * Build payment requirements from gateway configuration
   * Results are cached per gateway
   */
  async buildPaymentRequirements(gateway: {
    id: string;
    defaultPricePerRequest: string;
    defaultToken?: string | null;
    paymentScheme?: string;
    paymentNetwork?: string;
    evmAddress?: string;
  }): Promise<PaymentRequirements> {
    const networkId = (gateway.paymentNetwork || 'eip155:84532') as string;

    // Fetch token by defaultToken ID if provided, otherwise fallback to first token
    let token;
    if (gateway.defaultToken) {
      token = await this.prisma.token.findUnique({
        where: { id: gateway.defaultToken },
      });
      if (!token) {
        throw new Error(`Token ${gateway.defaultToken} not found`);
      }
    } else {
      const chain = await this.prisma.chain.findUnique({
        where: { id: networkId },
        include: { tokens: true },
      });
      if (!chain) {
        throw new Error(`Chain ${networkId} not found`);
      }
      if (chain.tokens.length === 0) {
        throw new Error(`Chain ${networkId} has no tokens`);
      }
      token = chain.tokens[0];
    }

    // Check cache first - now using gateway ID, network, and asset symbol
    const cacheKey = `${gateway.id}:${networkId}:${token.address}`;
    if (this.requirementsCache.has(cacheKey)) {
      return this.requirementsCache.get(cacheKey)!;
    }

    // Calculate amount with decimals
    // If user sets price as "0.1" USDC (6 decimals), amount = 0.1 * 10^6 = 100000
    const priceFloat = parseFloat(gateway.defaultPricePerRequest);
    if (isNaN(priceFloat)) {
      throw new Error(`Invalid price format: ${gateway.defaultPricePerRequest}`);
    }
    const amount = BigInt(Math.floor(priceFloat * Math.pow(10, token.decimals))).toString();

    const config: ResourceConfig = {
      scheme: gateway.paymentScheme || 'exact',
      network: networkId as `${string}:${string}`,
      payTo: gateway.evmAddress as `0x${string}`,
      price: {
        amount: amount,
        asset: token.address,
        extra: {
          name: token.name,
          version: token.version,
        },
      },
    };

    const builtRequirements = await this.resourceServer.buildPaymentRequirements(config);

    if (builtRequirements.length === 0) {
      throw new Error('Failed to build payment requirements');
    }

    const requirements = builtRequirements[0];
    this.requirementsCache.set(cacheKey, requirements);

    return requirements;
  }

  /**
   * Create a 402 Payment Required response
   */
  createPaymentRequiredResponse(
    requirements: PaymentRequirements,
    resourceInfo: {
      url: string;
      description?: string;
      mimeType?: string;
    },
  ): PaymentRequired {
    return this.resourceServer.createPaymentRequiredResponse([requirements], {
      url: resourceInfo.url,
      description: resourceInfo.description || 'Protected resource',
      mimeType: resourceInfo.mimeType || 'application/json',
    });
  }

  /**
   * Verify payment signature with facilitator
   * Returns verification result with isValid flag and optional invalidReason
   */
  async verifyPayment(
    paymentHeader: string,
    requirements: PaymentRequirements,
  ): Promise<{ isValid: boolean; invalidReason?: string; paymentPayload?: any }> {
    try {
      // Decode payment header (base64 encoded)
      const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));

      const verifyResult = await this.resourceServer.verifyPayment(paymentPayload, requirements);

      return {
        isValid: verifyResult.isValid,
        invalidReason: verifyResult.invalidReason,
        paymentPayload: verifyResult.isValid ? paymentPayload : undefined,
      };
    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        isValid: false,
        invalidReason: error instanceof Error ? error.message : 'Payment verification failed',
      };
    }
  }

  /**
   * Settle payment on-chain
   * Returns settlement result with transaction hash
   */
  async settlePayment(
    paymentPayload: any,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      const settleResult = await this.resourceServer.settlePayment(paymentPayload, requirements);
      console.log(`✅ Payment settled: ${settleResult.transaction}`);
      return settleResult;
    } catch (error) {
      console.error('Payment settlement error:', error);
      throw error;
    }
  }

  /**
   * Clear cached requirements for a gateway (e.g., after gateway update)
   */
  clearCache(gatewayId: string): void {
    for (const key of this.requirementsCache.keys()) {
      if (key.startsWith(`${gatewayId}:`)) {
        this.requirementsCache.delete(key);
      }
    }
  }
}

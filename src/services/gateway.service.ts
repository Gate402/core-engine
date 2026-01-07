import { getPrismaClient } from '../config/database';
import redis from '../config/redis';
import { generateSecretToken } from '../utils/crypto.util';
import { extractSubdomain } from '../utils/subdomain.util';

export class GatewayService {
  private prisma = getPrismaClient();
  async createGateway(data: {
    userId: string;
    subdomain: string;
    originUrl: string;
    defaultPricePerRequest: string;
    defaultToken?: string;
    customDomain?: string;
    paymentScheme?: string;
    paymentNetwork?: string;
    evmAddress: string;
  }) {
    // 1. Check subdomain availability
    const existing = await this.prisma.gateway.findUnique({
      where: { subdomain: data.subdomain },
    });
    if (existing) throw new Error('Subdomain already taken');

    if (data.customDomain) {
      const existingCustom = await this.prisma.gateway.findUnique({
        where: { customDomain: data.customDomain },
      });
      if (existingCustom) throw new Error('Custom domain already linked');
    }

    // 2. Validate token if provided
    if (data.defaultToken) {
      const tokenExists = await this.prisma.token.findUnique({
        where: { id: data.defaultToken },
      });
      if (!tokenExists) {
        throw new Error(`Token with ID ${data.defaultToken} does not exist`);
      }
    }

    // 3. Create Gateway
    const secretToken = generateSecretToken();
    const gateway = await this.prisma.gateway.create({
      data: {
        userId: data.userId,
        subdomain: data.subdomain,
        originUrl: data.originUrl,
        defaultPricePerRequest: data.defaultPricePerRequest,
        defaultToken: data.defaultToken,
        secretToken,
        customDomain: data.customDomain,
        paymentScheme: data.paymentScheme || 'exact',
        paymentNetwork: data.paymentNetwork || 'eip155:84532',
        evmAddress: data.evmAddress,
      },
    });

    return gateway;
  }

  async getGatewayById(id: string) {
    return this.prisma.gateway.findUnique({ where: { id } });
  }

  async getGatewaysByUser(userId: string) {
    return this.prisma.gateway.findMany({
      where: { userId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGatewaysWithStats(userId: string) {
    // Get all gateways for the user
    const gateways = await this.prisma.gateway.findMany({
      where: { userId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
    });

    // Get stats for each gateway
    const gatewaysWithStats = await Promise.all(
      gateways.map(async (gateway) => {
        // Get total requests count
        const totalRequests = await this.prisma.requestLog.count({
          where: { gatewayId: gateway.id },
        });

        // Get successful payments count
        const successfulPayments = await this.prisma.requestLog.count({
          where: {
            gatewayId: gateway.id,
            paymentValid: true,
          },
        });

        // Calculate total revenue
        const pricePerRequest = parseFloat(gateway.defaultPricePerRequest) || 0;
        const totalRevenue = successfulPayments * pricePerRequest;

        return {
          ...gateway,
          totalRequests,
          successfulPayments,
          totalRevenue,
        };
      }),
    );

    return gatewaysWithStats;
  }

  async updateGateway(
    id: string,
    data: Partial<{
      originUrl: string;
      defaultPricePerRequest: string;
      defaultToken: string | null;
      status: string;
      customDomain: string | null;
      paymentScheme: string;
      paymentNetwork: string;
      evmAddress: string;
    }>,
  ) {
    // Validate token if being updated
    if (data.defaultToken) {
      const tokenExists = await this.prisma.token.findUnique({
        where: { id: data.defaultToken },
      });
      if (!tokenExists) {
        throw new Error(`Token with ID ${data.defaultToken} does not exist`);
      }
    }
    const gateway = await this.prisma.gateway.update({
      where: { id },
      data,
    });

    // Invalidate cache
    await redis.del(`gateway:${gateway.subdomain}`);
    if (gateway.customDomain) {
      await redis.del(`gateway:${gateway.customDomain}`);
    }

    return gateway;
  }

  async deleteGateway(id: string) {
    const gateway = await this.prisma.gateway.update({
      where: { id },
      data: { status: 'deleted' },
    });

    // Invalidate cache
    await redis.del(`gateway:${gateway.subdomain}`);
    if (gateway.customDomain) {
      await redis.del(`gateway:${gateway.customDomain}`);
    }

    return gateway;
  }

  // --- caching logic for proxy ---

  async resolveGateway(host: string): Promise<any | null> {
    // Try cache first (using full hostname as cache key)
    const cached = await redis.get(`gateway:${host}`);
    if (cached) return JSON.parse(cached);

    // Extract subdomain from hostname (e.g., "client1.gate402.io" -> "client1")
    const subdomain = extractSubdomain(host);

    let gateway = null;

    // 1. Try subdomain match if we extracted one
    if (subdomain) {
      gateway = await this.prisma.gateway.findUnique({
        where: { subdomain },
      });
    }

    // 2. Fallback to custom domain match (full hostname)
    if (!gateway) {
      gateway = await this.prisma.gateway.findUnique({
        where: { customDomain: host },
      });
    }

    // 3. Cache and return if found and active
    if (gateway && gateway.status === 'active') {
      // Cache using full hostname as key for 5 minutes
      await redis.setex(`gateway:${host}`, 300, JSON.stringify(gateway));
      return gateway;
    }

    return null;
  }
}

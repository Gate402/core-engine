import { getPrismaClient } from '../config/database';
import redis from '../config/redis';
import { generateSecretToken } from '../utils/crypto.util';

export class GatewayService {
  private prisma = getPrismaClient();
  async createGateway(data: {
    userId: string;
    subdomain: string;
    originUrl: string;
    pricePerRequest: number;
    acceptedNetworks: string[];
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

    // 2. Create Gateway
    const secretToken = generateSecretToken();
    const gateway = await this.prisma.gateway.create({
      data: {
        userId: data.userId,
        subdomain: data.subdomain,
        originUrl: data.originUrl,
        pricePerRequest: data.pricePerRequest,
        acceptedNetworks: data.acceptedNetworks,
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

  async updateGateway(
    id: string,
    data: Partial<{
      originUrl: string;
      pricePerRequest: number;
      status: string;
      customDomain: string | null;
      paymentScheme: string;
      paymentNetwork: string;
      evmAddress: string;
    }>,
  ) {
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
    // Try cache
    const cached = await redis.get(`gateway:${host}`);
    if (cached) return JSON.parse(cached);

    // Try DB (subdomain or custom domain)
    // Assume host is either "sub.gate402.io" or "custom.com"
    // Logic: if host ends with gate402 domain, extract subdomain. Else check customDomain.
    // For now, let's keep it simple: try both fields.

    // Assuming subdomain is just the label, not full host?
    // The instruction said: "Extract subdomain from hostname" -> "alice-weather" from "alice-weather.gate402.io"
    // So this finder might receive just "alice-weather" OR "api.weatherpro.com"

    let gateway = await this.prisma.gateway.findUnique({
      where: { subdomain: host }, // try strictly as subdomain first
    });

    if (!gateway) {
      gateway = await this.prisma.gateway.findUnique({
        where: { customDomain: host },
      });
    }

    if (gateway && gateway.status === 'active') {
      await redis.setex(`gateway:${host}`, 300, JSON.stringify(gateway)); // 5 min TTL
      return gateway;
    }

    return null;
  }
}

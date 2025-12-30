import prisma from '../config/database';

export class AnalyticsService {
  /**
   * Fire-and-forget request logging
   */
  async logRequest(data: {
    gatewayId: string;
    method: string;
    path: string;
    statusCode: number;
    paymentRequired: boolean;
    paymentProvided: boolean;
    paymentValid: boolean;
    paymentId?: string;
    durationMs?: number;
    clientWallet?: string;
    clientIp?: string;
  }) {
    // Don't await this if calling from main flow, unless critical
    // Using prisma.create directly.
    try {
      await prisma.requestLog.create({
        data,
      });
    } catch (err) {
      console.error('Failed to log request:', err);
    }
  }

  async getGatewayOverview(gatewayId: string) {
    // Basic stats
    const totalRequests = await prisma.requestLog.count({
      where: { gatewayId },
    });

    const successfulPayments = await prisma.payment.count({
      where: { gatewayId, status: 'confirmed' },
    });

    const revenue = await prisma.payment.aggregate({
      where: { gatewayId, status: 'confirmed' },
      _sum: {
        providerRevenue: true,
      },
    });

    return {
      totalRequests,
      successfulPayments,
      totalRevenue: revenue._sum.providerRevenue || 0,
    };
  }

  async getTopPayers(gatewayId: string, limit = 10) {
    const topPayers = await prisma.payment.groupBy({
      by: ['fromWallet'],
      where: { gatewayId, status: 'confirmed' },
      _sum: {
        amount: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
      take: limit,
    });

    return topPayers.map((p) => ({
      wallet: p.fromWallet,
      totalSpent: p._sum.amount,
    }));
  }
}

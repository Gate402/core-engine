import { getPrismaClient } from '../config/database';

export class AnalyticsService {
  private prisma = getPrismaClient();
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
      await this.prisma.requestLog.create({
        data,
      });
    } catch (err) {
      console.error('Failed to log request:', err);
    }
  }
}

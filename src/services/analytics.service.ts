import { getPrismaClient } from '../config/database';
import type {
  ConversionFunnelResponse,
  GatewayOverviewResponse,
  RequestTimelineResponse,
  RevenueTimelineResponse,
  RouteAnalyticsResponse,
  TopPayerResponse,
  UserOverviewResponse,
  UserRequestsTimelineResponse,
  UserRevenueTimelineResponse,
} from '../types/analytics.types';

export interface RequestLogData {
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

  // Payment tracking
  paymentAmount?: string;
  paymentToken?: string;
  paymentNetwork?: string;
  settlementTxHash?: string;
  settlementStatus?: string;

  // Error tracking
  errorType?: string;
  errorMessage?: string;

  // Latency breakdown
  paymentVerifyMs?: number;
  settlementMs?: number;
  originLatencyMs?: number;
}

export class AnalyticsService {
  private prisma = getPrismaClient();

  /**
   * Fire-and-forget request logging with full analytics data
   */
  async logRequest(data: RequestLogData): Promise<void> {
    try {
      await this.prisma.requestLog.create({
        data: {
          gatewayId: data.gatewayId,
          method: data.method,
          path: data.path,
          statusCode: data.statusCode,
          paymentRequired: data.paymentRequired,
          paymentProvided: data.paymentProvided,
          paymentValid: data.paymentValid,
          paymentId: data.paymentId,
          durationMs: data.durationMs,
          clientWallet: data.clientWallet,
          clientIp: data.clientIp,
          paymentAmount: data.paymentAmount,
          paymentToken: data.paymentToken,
          paymentNetwork: data.paymentNetwork,
          settlementTxHash: data.settlementTxHash,
          settlementStatus: data.settlementStatus,
          errorType: data.errorType,
          errorMessage: data.errorMessage,
          paymentVerifyMs: data.paymentVerifyMs,
          settlementMs: data.settlementMs,
          originLatencyMs: data.originLatencyMs,
        },
      });
    } catch (err) {
      console.error('Failed to log request:', err);
    }
  }

  /**
   * Log request without blocking the main flow (true fire-and-forget)
   */
  logRequestAsync(data: RequestLogData): void {
    this.logRequest(data).catch((err) => {
      console.error('Async log request failed:', err);
    });
  }

  // ============ Analytics Query Methods ============

  /**
   * Get gateway overview statistics
   */
  async getGatewayOverview(
    gatewayId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<GatewayOverviewResponse> {
    const dateFilter = this.buildDateFilter(startDate, endDate);
    const endDateTime = startDate ?? new Date();
    const timeHoursGap = 12
    const startDateTime = new Date(endDateTime.getTime() - timeHoursGap * 60 * 60 * 1000);

    const [stats, uniquePayersResult, latencyResult] = await Promise.all([
      // Basic counts
      this.prisma.requestLog.aggregate({
        where: { gatewayId, ...dateFilter },
        _count: { id: true },
      }),
      // Unique payers
      this.prisma.requestLog.groupBy({
        by: ['clientWallet'],
        where: { gatewayId, paymentValid: true, clientWallet: { not: null }, ...dateFilter },
      }),
      // Average latency
      this.prisma.requestLog.aggregate({
        where: { gatewayId, durationMs: { not: null }, ...dateFilter },
        _avg: { durationMs: true },
      }),
    ]);

    // Payment stats
    const [successfulPayments, failedPayments, revenueResult] = await Promise.all([
      this.prisma.requestLog.count({
        where: { gatewayId, settlementStatus: 'success', ...dateFilter },
      }),
      this.prisma.requestLog.count({
        where: {
          gatewayId,
          paymentProvided: true,
          OR: [{ paymentValid: false }, { settlementStatus: 'failed' }],
          ...dateFilter,
        },
      }),
      // Sum revenue (raw query for BigInt sum)
      this.prisma.$queryRaw<[{ total: string | null }]>`
        SELECT COALESCE(SUM(CAST("paymentAmount" AS NUMERIC)), 0)::text as total
        FROM "RequestLog"
        WHERE "gatewayId" = ${gatewayId}
        AND "settlementStatus" = 'success'
        ${startDate ? this.prisma.$queryRaw`AND "createdAt" >= ${startDateTime.toISOString()}` : this.prisma.$queryRaw``}
        ${endDate ? this.prisma.$queryRaw`AND "createdAt" <= ${endDateTime.toISOString()}` : this.prisma.$queryRaw``}
      `,
    ]);

    const totalRequests = stats._count.id || 0;
    const conversionRate = totalRequests > 0 ? successfulPayments / totalRequests : 0;

    return {
      totalRequests,
      successfulPayments,
      failedPayments,
      totalRevenue: revenueResult[0]?.total || '0',
      uniquePayers: uniquePayersResult.length,
      avgLatencyMs: latencyResult._avg.durationMs
        ? Math.round(latencyResult._avg.durationMs)
        : null,
      conversionRate: Math.round(conversionRate * 10000) / 100, // percentage with 2 decimals
    };
  }

  /**
   * Get top payers for a gateway
   */
  async getTopPayers(
    gatewayId: string,
    limit = 10,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TopPayerResponse[]> {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const topPayers = await this.prisma.requestLog.groupBy({
      by: ['clientWallet'],
      where: {
        gatewayId,
        clientWallet: { not: null },
        settlementStatus: 'success',
        ...dateFilter,
      },
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    // Get revenue per wallet with raw query
    const wallets = topPayers
      .map((p) => p.clientWallet)
      .filter((w): w is string => w !== null);

    if (wallets.length === 0) return [];

    const revenueByWallet = await this.prisma.$queryRaw<{ wallet: string; total: string }[]>`
      SELECT "clientWallet" as wallet, COALESCE(SUM(CAST("paymentAmount" AS NUMERIC)), 0)::text as total
      FROM "RequestLog"
      WHERE "gatewayId" = ${gatewayId}
      AND "clientWallet" = ANY(${wallets})
      AND "settlementStatus" = 'success'
      GROUP BY "clientWallet"
    `;

    const revenueMap = new Map(revenueByWallet.map((r) => [r.wallet, r.total]));

    return topPayers.map((p) => ({
      wallet: p.clientWallet!,
      totalSpent: revenueMap.get(p.clientWallet!) || '0',
      requestCount: p._count.id,
      lastRequestAt: p._max.createdAt!,
    }));
  }

  /**
   * Get requests timeline (hourly/daily breakdown)
   */
  async getRequestsTimeline(
    gatewayId: string,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: Date,
    endDate?: Date,
  ): Promise<RequestTimelineResponse[]> {
    const dateFilter = this.buildDateFilter(startDate, endDate);
    const truncFn = this.getDateTruncFunction(interval);

    const result = await this.prisma.$queryRaw<
      { timestamp: Date; total: bigint; paid: bigint; failed: bigint }[]
    >`
      SELECT 
        DATE_TRUNC(${truncFn}, "createdAt") as timestamp,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "settlementStatus" = 'success') as paid,
        COUNT(*) FILTER (WHERE "statusCode" >= 400) as failed
      FROM "RequestLog"
      WHERE "gatewayId" = ${gatewayId}
      ${startDate ? this.prisma.$queryRaw`AND "createdAt" >= ${startDate}` : this.prisma.$queryRaw``}
      ${endDate ? this.prisma.$queryRaw`AND "createdAt" <= ${endDate}` : this.prisma.$queryRaw``}
      GROUP BY DATE_TRUNC(${truncFn}, "createdAt")
      ORDER BY timestamp ASC
    `;

    return result.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      totalRequests: Number(r.total),
      paidRequests: Number(r.paid),
      failedRequests: Number(r.failed),
    }));
  }

  /**
   * Get revenue timeline
   */
  async getRevenueTimeline(
    gatewayId: string,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: Date,
    endDate?: Date,
  ): Promise<RevenueTimelineResponse[]> {
    const dateFilter = this.buildDateFilter(startDate, endDate);
    const truncFn = this.getDateTruncFunction(interval);

    const result = await this.prisma.$queryRaw<
      { timestamp: Date; revenue: string; count: bigint }[]
    >`
      SELECT 
        DATE_TRUNC(${truncFn}, "createdAt") as timestamp,
        COALESCE(SUM(CAST("paymentAmount" AS NUMERIC)), 0)::text as revenue,
        COUNT(*) as count
      FROM "RequestLog"
      WHERE "gatewayId" = ${gatewayId}
      AND "settlementStatus" = 'success'
      ${startDate ? this.prisma.$queryRaw`AND "createdAt" >= ${startDate}` : this.prisma.$queryRaw``}
      ${endDate ? this.prisma.$queryRaw`AND "createdAt" <= ${endDate}` : this.prisma.$queryRaw``}
      GROUP BY DATE_TRUNC(${truncFn}, "createdAt")
      ORDER BY timestamp ASC
    `;

    return result.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      revenue: r.revenue,
      paymentCount: Number(r.count),
    }));
  }

  /**
   * Get route analytics (most popular endpoints)
   */
  async getRouteAnalytics(
    gatewayId: string,
    limit = 20,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RouteAnalyticsResponse[]> {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const result = await this.prisma.$queryRaw<
      {
        path: string;
        method: string;
        total: bigint;
        paid: bigint;
        avg_latency: number | null;
        revenue: string;
      }[]
    >`
      SELECT 
        "path",
        "method",
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "settlementStatus" = 'success') as paid,
        AVG("durationMs") as avg_latency,
        COALESCE(SUM(CAST("paymentAmount" AS NUMERIC)) FILTER (WHERE "settlementStatus" = 'success'), 0)::text as revenue
      FROM "RequestLog"
      WHERE "gatewayId" = ${gatewayId}
      ${startDate ? this.prisma.$queryRaw`AND "createdAt" >= ${startDate}` : this.prisma.$queryRaw``}
      ${endDate ? this.prisma.$queryRaw`AND "createdAt" <= ${endDate}` : this.prisma.$queryRaw``}
      GROUP BY "path", "method"
      ORDER BY total DESC
      LIMIT ${limit}
    `;

    return result.map((r) => ({
      path: r.path,
      method: r.method,
      totalRequests: Number(r.total),
      paidRequests: Number(r.paid),
      avgLatencyMs: r.avg_latency ? Math.round(r.avg_latency) : null,
      revenue: r.revenue,
    }));
  }

  /**
   * Get conversion funnel analytics
   */
  async getConversionFunnel(
    gatewayId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ConversionFunnelResponse> {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const [totalRequests, paymentRequired, paymentAttempts, validPayments, settledPayments] =
      await Promise.all([
        this.prisma.requestLog.count({ where: { gatewayId, ...dateFilter } }),
        this.prisma.requestLog.count({
          where: { gatewayId, statusCode: 402, ...dateFilter },
        }),
        this.prisma.requestLog.count({
          where: { gatewayId, paymentProvided: true, ...dateFilter },
        }),
        this.prisma.requestLog.count({
          where: { gatewayId, paymentValid: true, ...dateFilter },
        }),
        this.prisma.requestLog.count({
          where: { gatewayId, settlementStatus: 'success', ...dateFilter },
        }),
      ]);

    const attemptRate = paymentRequired > 0 ? paymentAttempts / paymentRequired : 0;
    const validationRate = paymentAttempts > 0 ? validPayments / paymentAttempts : 0;
    const settlementRate = validPayments > 0 ? settledPayments / validPayments : 0;
    const overallRate = paymentRequired > 0 ? settledPayments / paymentRequired : 0;

    return {
      totalRequests,
      paymentRequiredCount: paymentRequired,
      paymentAttemptCount: paymentAttempts,
      validPaymentCount: validPayments,
      settledPaymentCount: settledPayments,
      rates: {
        attemptRate: Math.round(attemptRate * 10000) / 100,
        validationRate: Math.round(validationRate * 10000) / 100,
        settlementRate: Math.round(settlementRate * 10000) / 100,
        overallRate: Math.round(overallRate * 10000) / 100,
      },
    };
  }

  // ============ User-Level Analytics (Dashboard) ============

  /**
   * Get user overview statistics across all their gateways
   */
  async getUserOverview(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UserOverviewResponse> {
    // Get all gateways for this user
    const gateways = await this.prisma.gateway.findMany({
      where: { userId, status: { not: 'deleted' } },
      select: { id: true, subdomain: true },
    });

    if (gateways.length === 0) {
      return {
        totalGateways: 0,
        totalRequests: 0,
        successfulPayments: 0,
        totalRevenue: '0',
        uniquePayers: 0,
        avgLatencyMs: null,
        gatewayBreakdown: [],
      };
    }

    const gatewayIds = gateways.map((g) => g.id);
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // Aggregate stats across all gateways
    const [totalStats, successfulPayments, uniquePayersResult, latencyResult] = await Promise.all([
      this.prisma.requestLog.aggregate({
        where: { gatewayId: { in: gatewayIds }, ...dateFilter },
        _count: { id: true },
      }),
      this.prisma.requestLog.count({
        where: { gatewayId: { in: gatewayIds }, settlementStatus: 'success', ...dateFilter },
      }),
      this.prisma.requestLog.groupBy({
        by: ['clientWallet'],
        where: {
          gatewayId: { in: gatewayIds },
          paymentValid: true,
          clientWallet: { not: null },
          ...dateFilter,
        },
      }),
      this.prisma.requestLog.aggregate({
        where: { gatewayId: { in: gatewayIds }, durationMs: { not: null }, ...dateFilter },
        _avg: { durationMs: true },
      }),
    ]);

    // Get total revenue using raw query
    const revenueResult = await this.prisma.$queryRaw<[{ total: string }]>`
      SELECT COALESCE(SUM(CAST("paymentAmount" AS NUMERIC)), 0)::text as total
      FROM "RequestLog"
      WHERE "gatewayId" = ANY(${gatewayIds})
      AND "settlementStatus" = 'success'
      ${startDate ? this.prisma.$queryRaw`AND "createdAt" >= ${startDate}` : this.prisma.$queryRaw``}
      ${endDate ? this.prisma.$queryRaw`AND "createdAt" <= ${endDate}` : this.prisma.$queryRaw``}
    `;

    // Get per-gateway breakdown
    const gatewayBreakdown = await Promise.all(
      gateways.map(async (gateway) => {
        const [reqCount, revResult] = await Promise.all([
          this.prisma.requestLog.count({
            where: { gatewayId: gateway.id, ...dateFilter },
          }),
          this.prisma.$queryRaw<[{ total: string }]>`
            SELECT COALESCE(SUM(CAST("paymentAmount" AS NUMERIC)), 0)::text as total
            FROM "RequestLog"
            WHERE "gatewayId" = ${gateway.id}
            AND "settlementStatus" = 'success'
            ${startDate ? this.prisma.$queryRaw`AND "createdAt" >= ${startDate}` : this.prisma.$queryRaw``}
            ${endDate ? this.prisma.$queryRaw`AND "createdAt" <= ${endDate}` : this.prisma.$queryRaw``}
          `,
        ]);

        return {
          gatewayId: gateway.id,
          subdomain: gateway.subdomain,
          totalRequests: reqCount,
          totalRevenue: revResult[0]?.total || '0',
        };
      }),
    );

    return {
      totalGateways: gateways.length,
      totalRequests: totalStats._count.id || 0,
      successfulPayments,
      totalRevenue: revenueResult[0]?.total || '0',
      uniquePayers: uniquePayersResult.length,
      avgLatencyMs: latencyResult._avg.durationMs
        ? Math.round(latencyResult._avg.durationMs)
        : null,
      gatewayBreakdown,
    };
  }

  /**
   * Get user revenue timeline across all their gateways
   */
  async getUserRevenueTimeline(
    userId: string,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: Date,
    endDate?: Date,
  ): Promise<UserRevenueTimelineResponse[]> {
    // Get all gateways for this user
    const gateways = await this.prisma.gateway.findMany({
      where: { userId, status: { not: 'deleted' } },
      select: { id: true },
    });

    if (gateways.length === 0) return [];

    const gatewayIds = gateways.map((g) => g.id);
    const truncFn = this.getDateTruncFunction(interval);

    const result = await this.prisma.$queryRaw<
      { timestamp: Date; revenue: string; count: bigint }[]
    >`
      SELECT 
        DATE_TRUNC(${truncFn}, "createdAt") as timestamp,
        COALESCE(SUM(CAST("paymentAmount" AS NUMERIC)), 0)::text as revenue,
        COUNT(*) as count
      FROM "RequestLog"
      WHERE "gatewayId" = ANY(${gatewayIds})
      AND "settlementStatus" = 'success'
      ${startDate ? this.prisma.$queryRaw`AND "createdAt" >= ${startDate}` : this.prisma.$queryRaw``}
      ${endDate ? this.prisma.$queryRaw`AND "createdAt" <= ${endDate}` : this.prisma.$queryRaw``}
      GROUP BY DATE_TRUNC(${truncFn}, "createdAt")
      ORDER BY timestamp ASC
    `;

    return result.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      revenue: r.revenue,
      paymentCount: Number(r.count),
    }));
  }

  /**
   * Get user requests timeline across all their gateways
   */
  async getUserRequestsTimeline(
    userId: string,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: Date,
    endDate?: Date,
  ): Promise<UserRequestsTimelineResponse[]> {
    // Get all gateways for this user
    const gateways = await this.prisma.gateway.findMany({
      where: { userId, status: { not: 'deleted' } },
      select: { id: true },
    });

    if (gateways.length === 0) return [];

    const gatewayIds = gateways.map((g) => g.id);
    const truncFn = this.getDateTruncFunction(interval);

    const result = await this.prisma.$queryRaw<
      { timestamp: Date; total: bigint; paid: bigint; failed: bigint }[]
    >`
      SELECT 
        DATE_TRUNC(${truncFn}, "createdAt") as timestamp,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "settlementStatus" = 'success') as paid,
        COUNT(*) FILTER (WHERE "statusCode" >= 400) as failed
      FROM "RequestLog"
      WHERE "gatewayId" = ANY(${gatewayIds})
      ${startDate ? this.prisma.$queryRaw`AND "createdAt" >= ${startDate}` : this.prisma.$queryRaw``}
      ${endDate ? this.prisma.$queryRaw`AND "createdAt" <= ${endDate}` : this.prisma.$queryRaw``}
      GROUP BY DATE_TRUNC(${truncFn}, "createdAt")
      ORDER BY timestamp ASC
    `;

    return result.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      totalRequests: Number(r.total),
      paidRequests: Number(r.paid),
      failedRequests: Number(r.failed),
    }));
  }

  // ============ Helper Methods ============

  private buildDateFilter(startDate?: Date, endDate?: Date) {
    const filter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.gte = startDate;
      if (endDate) filter.createdAt.lte = endDate;
    }
    return filter;
  }

  private getDateTruncFunction(interval: 'hour' | 'day' | 'week' | 'month'): string {
    return interval;
  }
}



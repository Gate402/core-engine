import { Controller, Get, Query, Request, Response, Route, Security, Tags } from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import type {
  ConversionFunnelResponse,
  GatewayOverviewResponse,
  LatestTransactionResponse,
  RequestTimelineResponse,
  RevenueTimelineResponse,
  RouteAnalyticsResponse,
  TopPayerResponse,
  UserOverviewResponse,
  UserRequestsTimelineResponse,
  UserRevenueTimelineResponse,
} from '../types/analytics.types';
import type { ErrorResponse } from '../types/auth.types';

@Route('analytics')
@Tags('Analytics')
@Security('jwt')
export class AnalyticsTsoaController extends Controller {
  private analyticsService = new AnalyticsService();

  // ============ User-Level Analytics (Dashboard) ============

  /**
   * Get user overview statistics across all gateways for the dashboard
   * @summary User Dashboard Overview
   */
  @Get('user/overview')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getUserOverview(
    @Request() req: ExpressRequest,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<UserOverviewResponse> {
    const userId = (req as any).user.userId;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getUserOverview(userId, start, end);
  }

  /**
   * Get user revenue timeline across all gateways
   * @summary User Revenue Timeline
   */
  @Get('user/revenue-timeline')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getUserRevenueTimeline(
    @Request() req: ExpressRequest,
    @Query() interval?: 'hour' | 'day' | 'week' | 'month',
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<UserRevenueTimelineResponse[]> {
    const userId = (req as any).user.userId;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getUserRevenueTimeline(userId, interval || 'day', start, end);
  }

  /**
   * Get user requests timeline across all gateways
   * @summary User Requests Timeline
   */
  @Get('user/requests-timeline')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getUserRequestsTimeline(
    @Request() req: ExpressRequest,
    @Query() interval?: 'hour' | 'day' | 'week' | 'month',
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<UserRequestsTimelineResponse[]> {
    const userId = (req as any).user.userId;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getUserRequestsTimeline(userId, interval || 'day', start, end);
  }

  // ============ Gateway-Level Analytics ============

  /**
   * Get overview statistics for a gateway
   * @summary Gateway Overview
   */
  @Get('overview')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getOverview(
    @Query() gatewayId: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<GatewayOverviewResponse> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getGatewayOverview(gatewayId, start, end);
  }

  /**
   * Get top payers for a gateway
   * @summary Top Payers
   */
  @Get('top-payers')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getTopPayers(
    @Query() gatewayId: string,
    @Query() limit?: number,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<TopPayerResponse[]> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getTopPayers(gatewayId, limit || 10, start, end);
  }

  /**
   * Get requests timeline for a gateway
   * @summary Requests Timeline
   */
  @Get('requests-timeline')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getRequestsTimeline(
    @Query() gatewayId: string,
    @Query() interval?: 'hour' | 'day' | 'week' | 'month',
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<RequestTimelineResponse[]> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getRequestsTimeline(gatewayId, interval || 'day', start, end);
  }

  /**
   * Get revenue timeline for a gateway
   * @summary Revenue Timeline
   */
  @Get('revenue-timeline')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getRevenueTimeline(
    @Query() gatewayId: string,
    @Query() interval?: 'hour' | 'day' | 'week' | 'month',
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<RevenueTimelineResponse[]> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getRevenueTimeline(gatewayId, interval || 'day', start, end);
  }

  /**
   * Get route analytics for a gateway (most popular endpoints)
   * @summary Route Analytics
   */
  @Get('routes')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getRouteAnalytics(
    @Query() gatewayId: string,
    @Query() limit?: number,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<RouteAnalyticsResponse[]> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getRouteAnalytics(gatewayId, limit || 20, start, end);
  }

  /**
   * Get conversion funnel analytics for a gateway
   * @summary Conversion Funnel
   */
  @Get('conversion-funnel')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getConversionFunnel(
    @Query() gatewayId: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<ConversionFunnelResponse> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getConversionFunnel(gatewayId, start, end);
  }

  /**
   * Get latest transactions for a gateway
   * @summary Latest Transactions
   */
  @Get('latest-transactions')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getLatestTransactions(
    @Query() gatewayId: string,
    @Query() limit?: number,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<LatestTransactionResponse[]> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getLatestTransactions(gatewayId, limit || 50, start, end);
  }

  /**
   * Get a specific request log by ID
   * @summary Get Request Log by ID
   */
  @Get('request-log/{requestLogId}')
  @Response<ErrorResponse>(401, 'Unauthorized')
  @Response<ErrorResponse>(404, 'Not Found')
  public async getRequestLogById(requestLogId: string): Promise<LatestTransactionResponse> {
    const requestLog = await this.analyticsService.getRequestLogById(requestLogId);

    if (!requestLog) {
      this.setStatus(404);
      throw new Error('Request log not found');
    }

    return requestLog;
  }
}

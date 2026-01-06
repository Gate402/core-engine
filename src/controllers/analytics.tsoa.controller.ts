import { Controller, Get, Query, Response, Route, Security, Tags } from 'tsoa';
import { AnalyticsService } from '../services/analytics.service';
import type { GatewayOverviewResponse, TopPayerResponse } from '../types/analytics.types';
import type { ErrorResponse } from '../types/auth.types';

@Route('analytics')
@Tags('Analytics')
@Security('jwt')
export class AnalyticsTsoaController extends Controller {
  private analyticsService = new AnalyticsService();

  /**
   * Get overview statistics for a gateway
   * @summary Gateway Overview
   */
  @Get('overview')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getOverview(@Query() gatewayId: string): Promise<GatewayOverviewResponse> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    // TODO: Verify ownership
    // const stats = await this.analyticsService.getGatewayOverview(gatewayId);
    return {
      totalRequests: 0,
      successfulPayments: 0,
      totalRevenue: 0,
    };
  }

  /**
   * Get top payers for a gateway
   * @summary Top Payers
   */
  @Get('top-payers')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getTopPayers(@Query() gatewayId: string): Promise<TopPayerResponse[]> {
    if (!gatewayId) {
      this.setStatus(400);
      throw new Error('gatewayId required');
    }

    // const topPayers = await this.analyticsService.getTopPayers(gatewayId);
    // return topPayers.map(p => ({
    //   wallet: p.wallet,
    //   totalSpent: p.totalSpent ? Number(p.totalSpent) : null,
    // }));
    return [];
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Request,
  Response,
  Route,
  Security,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { GatewayService } from '../services/gateway.service';
import { generateSubdomain } from '../utils/subdomain.util';
import { isValidSubdomain } from '../utils/subdomain.util';
import type {
  CreateGatewayRequest,
  GatewayResponse,
  QuickCreateGatewayRequest,
  QuickCreateGatewayResponse,
  UpdateGatewayRequest,
} from '../types/gateway.types';
import type { ErrorResponse } from '../types/auth.types';

// Helper to convert Prisma Gateway to response type (handles Decimal)
function toGatewayResponse(gateway: any): GatewayResponse {
  return {
    ...gateway,
    defaultPricePerRequest: Number(gateway.defaultPricePerRequest),
  };
}

@Route('gateways')
@Tags('Gateways')
@Security('jwt')
export class GatewayTsoaController extends Controller {
  private gatewayService = new GatewayService();

  /**
   * Quick-create a gateway with auto-generated subdomain
   * @summary Quick Create Gateway
   */
  @Post('quick-create')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async quickCreate(
    @Request() req: ExpressRequest,
    @Body() body: QuickCreateGatewayRequest,
  ): Promise<QuickCreateGatewayResponse> {
    const userId = (req as any).user.userId;

    if (!body.originUrl || !body.pricePerRequest || !body.defaultToken || !body.evmAddress) {
      this.setStatus(400);
      throw new Error(
        'Missing required fields (originUrl, pricePerRequest, defaultToken, evmAddress)',
      );
    }

    // Auto-generate subdomain from origin URL
    const subdomain = generateSubdomain(body.originUrl);

    // Get network configuration from environment
    const mainnetEnabled = process.env.MAINNET_ENABLED === 'true';
    const defaultNetwork = process.env.DEFAULT_NETWORK || 'eip155:84532';
    const paymentNetwork = mainnetEnabled ? defaultNetwork : 'eip155:84532';

    try {
      const gateway = await this.gatewayService.createGateway({
        userId,
        subdomain,
        originUrl: body.originUrl,
        defaultPricePerRequest: body.pricePerRequest.toString(),
        defaultToken: body.defaultToken,
        paymentScheme: 'exact',
        paymentNetwork,
        evmAddress: body.evmAddress,
      });

      this.setStatus(201);
      return {
        ...toGatewayResponse(gateway),
        gatewayUrl: `https://${gateway.subdomain}.gate402.io`,
        testUrl: `http://${gateway.subdomain}.localhost:3030`,
        network: paymentNetwork,
        isTestnet: paymentNetwork === 'eip155:84532',
      };
    } catch (err: any) {
      // If subdomain collision, retry with new random suffix
      if (err.message.includes('Subdomain already taken')) {
        return this.quickCreate(req, body);
      }
      this.setStatus(400);
      throw err;
    }
  }

  /**
   * Create a new gateway with custom configuration
   * @summary Create Gateway
   */
  @Post()
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async createGateway(
    @Request() req: ExpressRequest,
    @Body() body: CreateGatewayRequest,
  ): Promise<GatewayResponse> {
    const userId = (req as any).user.userId;

    if (
      !body.originUrl ||
      !body.pricePerRequest ||
      !body.subdomain ||
      !body.defaultToken ||
      !body.evmAddress
    ) {
      this.setStatus(400);
      throw new Error(
        'Missing required fields (originUrl, pricePerRequest, subdomain, defaultToken, evmAddress)',
      );
    }

    if (!isValidSubdomain(body.subdomain)) {
      this.setStatus(400);
      throw new Error('Invalid subdomain format');
    }

    const gateway = await this.gatewayService.createGateway({
      userId,
      subdomain: body.subdomain,
      originUrl: body.originUrl,
      defaultPricePerRequest: body.pricePerRequest.toString(),
      defaultToken: body.defaultToken,
      customDomain: body.customDomain,
      paymentScheme: body.paymentScheme,
      paymentNetwork: body.paymentNetwork,
      evmAddress: body.evmAddress,
    });

    this.setStatus(201);
    return toGatewayResponse(gateway);
  }

  /**
   * Get all gateways for the authenticated user
   * @summary List User Gateways
   */
  @Get()
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async getGatewaysByUser(@Request() req: ExpressRequest): Promise<GatewayResponse[]> {
    const userId = (req as any).user.userId;
    const gateways = await this.gatewayService.getGatewaysByUser(userId);
    return gateways.map(toGatewayResponse);
  }

  /**
   * Get a specific gateway by ID
   * @summary Get Gateway
   */
  @Get('{gatewayId}')
  @Response<ErrorResponse>(404, 'Not Found')
  public async getGatewayById(@Path() gatewayId: string): Promise<GatewayResponse> {
    const gateway = await this.gatewayService.getGatewayById(gatewayId);
    if (!gateway) {
      this.setStatus(404);
      throw new Error('Gateway not found');
    }
    return toGatewayResponse(gateway);
  }

  /**
   * Update a gateway
   * @summary Update Gateway
   */
  @Patch('{gatewayId}')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(404, 'Not Found')
  public async updateGateway(
    @Path() gatewayId: string,
    @Body() body: UpdateGatewayRequest,
  ): Promise<GatewayResponse> {
    // TODO: Verify ownership
    const gateway = await this.gatewayService.updateGateway(gatewayId, body);
    return toGatewayResponse(gateway);
  }

  /**
   * Delete a gateway (soft delete)
   * @summary Delete Gateway
   */
  @Delete('{gatewayId}')
  @Response<ErrorResponse>(404, 'Not Found')
  public async deleteGateway(@Path() gatewayId: string): Promise<void> {
    // TODO: Verify ownership
    await this.gatewayService.deleteGateway(gatewayId);
    this.setStatus(204);
  }
}

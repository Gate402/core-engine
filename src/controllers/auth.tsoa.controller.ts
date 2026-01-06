import {
  Body,
  Controller,
  Post,
  Request,
  Response,
  Route,
  Security,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { AuthenticationService } from '../services/authentication.service';
import type {
  AuthResponse,
  ErrorResponse,
  GoogleLoginRequest,
  MessageResponse,
  NonceResponse,
  OtpRequestBody,
  OtpVerifyRequest,
  RefreshTokenRequest,
  SiweNonceRequest,
  SiweVerifyRequest,
  UpdateProfileRequest,
} from '../types/auth.types';
import { toUserResponse } from '../types/auth.types';

@Route('auth')
@Tags('Authentication')
export class AuthTsoaController extends Controller {
  private authService = new AuthenticationService();

  /**
   * Authenticate using Google OAuth token
   * @summary Google OAuth Login
   */
  @Post('google')
  @Response<ErrorResponse>(400, 'Bad Request')
  public async googleLogin(
    @Body() body: GoogleLoginRequest
  ): Promise<AuthResponse> {
    const result = await this.authService.verifyGoogleToken(body.token);
    return {
      user: toUserResponse(result.user),
      tokens: result.tokens,
    };
  }

  /**
   * Request OTP to be sent to email
   * @summary Request OTP
   */
  @Post('otp/request')
  @Response<ErrorResponse>(400, 'Bad Request')
  public async requestOtp(@Body() body: OtpRequestBody): Promise<MessageResponse> {
    await this.authService.requestOtp(body.email);
    return { message: 'OTP sent' };
  }

  /**
   * Verify OTP and get authentication tokens
   * @summary Verify OTP
   */
  @Post('otp/verify')
  @Response<ErrorResponse>(400, 'Bad Request')
  public async verifyOtp(@Body() body: OtpVerifyRequest): Promise<AuthResponse> {
    const result = await this.authService.verifyOtp(body.email, body.otp);
    return {
      user: toUserResponse(result.user),
      tokens: result.tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   * @summary Refresh Token
   */
  @Post('refresh')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async refreshToken(
    @Body() body: RefreshTokenRequest
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  /**
   * Get nonce for SIWE (Sign-In With Ethereum) authentication
   * @summary Get SIWE Nonce
   */
  @Post('siwe/nonce')
  @Response<ErrorResponse>(400, 'Bad Request')
  public async getSiweNonce(@Body() body: SiweNonceRequest): Promise<NonceResponse> {
    return this.authService.getNonce(body.address);
  }

  /**
   * Verify SIWE signature and get authentication tokens
   * @summary Verify SIWE Signature
   */
  @Post('siwe/verify')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async verifySiwe(@Body() body: SiweVerifyRequest): Promise<AuthResponse> {
    const result = await this.authService.verifySiwe(body.message, body.signature);
    return {
      user: toUserResponse(result.user),
      tokens: result.tokens,
    };
  }

  /**
   * Update user profile (requires authentication)
   * @summary Update Profile
   */
  @Post('siwe/complete-profile')
  @Security('jwt')
  @Response<ErrorResponse>(400, 'Bad Request')
  @Response<ErrorResponse>(401, 'Unauthorized')
  public async updateProfile(
    @Request() req: ExpressRequest,
    @Body() body: UpdateProfileRequest
  ): Promise<AuthResponse> {
    const userId = (req as any).user.userId;
    const result = await this.authService.updateProfile(userId, body.email, body.name);
    return {
      user: toUserResponse(result.user),
      tokens: result.tokens,
    };
  }
}

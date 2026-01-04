import { User } from '@prisma/client';

// ============ Request Types ============

export interface GoogleLoginRequest {
  /** Google OAuth ID token */
  token: string;
}

export interface OtpRequestBody {
  /** User's email address */
  email: string;
}

export interface OtpVerifyRequest {
  /** User's email address */
  email: string;
  /** 6-digit OTP code */
  otp: string;
}

export interface RefreshTokenRequest {
  /** JWT refresh token */
  refreshToken: string;
}

export interface SiweNonceRequest {
  /** Ethereum wallet address */
  address: string;
}

export interface SiweVerifyRequest {
  /** SIWE message that was signed */
  message: string;
  /** Wallet signature of the message */
  signature: string;
}

export interface UpdateProfileRequest {
  /** New email address */
  email: string;
  /** User's display name */
  name: string;
}

// ============ Response Types ============

export interface AuthTokens {
  /** JWT access token (15 min expiry) */
  accessToken: string;
  /** JWT refresh token (7 day expiry) */
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  evmAddress: string | null;
  createdAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

export interface MessageResponse {
  message: string;
}

export interface NonceResponse {
  nonce: string;
}

export interface ErrorResponse {
  error: string;
}

// Helper to convert Prisma User to UserResponse
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    evmAddress: user.evmAddress,
    createdAt: user.createdAt,
  };
}

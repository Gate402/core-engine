import { User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import crypto from 'crypto';
import { getPrismaClient } from '../config/database';
import { verifyMessage } from 'viem';
import { nanoid } from 'nanoid';

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
// Access token validity: 15 minutes, Refresh token validity: 7 days
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER || 'user',
    pass: process.env.SMTP_PASS || 'pass',
  },
});

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export class AuthenticationService {
  private prisma = getPrismaClient();

  /**
   * Generates Access and Refresh tokens for a user
   */
  public generateTokens(user: User) {
    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(
      { userId: user.id, tokenVersion: 1 }, // TODO: Add token version to User model for revocation
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verifies Google ID Token and returns user (creating if necessary)
   */
  public async verifyGoogleToken(token: string): Promise<{ user: User; tokens: any }> {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new Error('Invalid Google Token payload');
      }

      const { email, sub: googleId, name } = payload;

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            googleId,
            name: name || '',
          },
        });
      } else if (!user.googleId) {
        // Link Google ID if email exists but not linked
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }

      const tokens = this.generateTokens(user);
      return { user, tokens };
    } catch (error) {
      console.error('Google verification error:', error);
      throw new Error('Invalid Google Token');
    }
  }

  /**
   * Requests an OTP for email login
   */
  public async requestOtp(email: string): Promise<void> {
    // use default otp value since this is for prototyping only
    const otp = process.env.DEFAULT_OTP_VALUE ?? crypto.randomInt(100000, 999999).toString();
    const key = `otp:${email}`;

    // Store OTP in Redis with 5 minutes expiration
    await redis.set(key, otp, 'EX', 300);

    // Send email
    if (process.env.SMTP_HOST && process.env.SMTP_HOST !== 'smtp.example.com') {
      try {
        await transporter.sendMail({
          from: '"Gate402 Auth" <no-reply@gate402.com>',
          to: email,
          subject: 'Your Login OTP',
          text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
        });
      } catch (e) {
        console.error('Failed to send email, logging OTP instead:', e);
        console.log(`[DEV] OTP for ${email}: ${otp}`);
      }
    } else {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }
  }

  /**
   * Verifies OTP and returns tokens
   */
  public async verifyOtp(email: string, otp: string): Promise<{ user: User; tokens: any }> {
    const key = `otp:${email}`;
    const storedOtp = await redis.get(key);

    if (!storedOtp || storedOtp !== otp) {
      throw new Error('Invalid or expired OTP');
    }

    // Clear OTP
    await redis.del(key);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
        },
      });
    }

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  /**
   * Generates or retrieves a nonce for an EVM address
   */
  public async getNonce(evmAddress: string): Promise<{ nonce: string }> {
    const nonce = nanoid();

    let user = await this.prisma.user.findUnique({
      where: { evmAddress: evmAddress.toLowerCase() },
    });

    if (!user) {
      // Create user if it doesn't exist, but only with evmAddress for now
      // They will complete profile later if needed
      // Check if email exists? No, email is unique. For SIWE, we might not have email yet.
      // We need to handle the case where we don't have an email.
      // However, the User model has `email String @unique`.
      // If the schema requires email, we have a problem for pure SIWE users without email.
      // Let's check schema: `email String @unique`.
      // We must generate a placeholder email or change schema.
      // Plan didn't catch this.
      // Strategy: Generate a placeholder email: `wallet_ADDRESS@gate402.eth`

      const placeholderEmail = `${evmAddress.toLowerCase()}@noemail-gate402.eth`;

      // Check if this placeholder already exists (collision unlikely but possible if user manually set it)
      const existingUser = await this.prisma.user.findUnique({
        where: { email: placeholderEmail },
      });
      if (existingUser) {
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { nonce },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: placeholderEmail,
            evmAddress: evmAddress.toLowerCase(),
            nonce,
          },
        });
      }
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { nonce },
      });
    }

    return { nonce: user.nonce! };
  }

  /**
   * Verifies SIWE signature and returns tokens
   */
  public async verifySiwe(
    message: string,
    signature: string,
  ): Promise<{ user: User; tokens: any }> {
    // 1. Verify signature using viem
    // We assume the message is the raw text signed

    // Very simple parsing to extract address - robust parsing would be better but keeping it simple as per plan
    // SIWE message format usually contains "Ethereum address: 0x..."
    // We will rely on the provided address in the message matching the recovered address.

    // Recover the address from the signature
    const recoveredAddress = await import('viem').then((m) =>
      m.recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      }),
    );

    // We expect the message to contain the address, but for now we trust the recovered address
    // satisfies the ownership if it matches a user with a valid nonce.
    // Ideally we parse the message to ensure it is valid SIWE message.

    const valid = await verifyMessage({
      address: recoveredAddress,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      throw new Error('Invalid signature');
    }

    // Check if address matches a user with the nonce
    // We need to extract the nonce from the message to ensure it matches what we expect,
    // OR simply look up the user by address and check if the nonce is IN the message.

    const user = await this.prisma.user.findFirst({
      where: { evmAddress: recoveredAddress.toLowerCase() },
    });

    if (!user || !user.nonce) {
      throw new Error('User or nonce not found');
    }

    // Verify nonce is present in the message
    if (!message.includes(user.nonce)) {
      throw new Error('Nonce mismatch or not found in message');
    }

    // Rotate nonce
    await this.prisma.user.update({
      where: { id: user.id },
      data: { nonce: nanoid() },
    });

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  /**
   * Refreshes access token using refresh token
   */
  public async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      const { userId } = payload;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check token version if implemented
      // if (user.tokenVersion !== payload.tokenVersion) throw new Error('Token revoked');

      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Updates user profile (email, name)
   */
  public async updateProfile(
    userId: string,
    email: string,
    name: string,
  ): Promise<{ user: User; tokens: any }> {
    // Check if email is taken by another user
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error('Email already in use');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email,
        name,
      },
    });

    // Generate new tokens since email (part of payload) might have changed
    const tokens = this.generateTokens(user);
    return { user, tokens };
  }
}

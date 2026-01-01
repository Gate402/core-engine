import { Request, Response } from 'express';
import { AuthenticationService } from '../services/authentication.service';
import { z } from 'zod';

export class AuthController {
  constructor(private authService: AuthenticationService) {}

  public googleLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        token: z.string(),
      });
      const { token } = schema.parse(req.body);

      const result = await this.authService.verifyGoogleToken(token);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public requestOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        email: z.string().email(),
      });
      const { email } = schema.parse(req.body);

      await this.authService.requestOtp(email);
      res.json({ message: 'OTP sent' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public verifyOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        email: z.string().email(),
        otp: z.string().length(6),
      });
      const { email, otp } = schema.parse(req.body);

      const result = await this.authService.verifyOtp(email, otp);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        refreshToken: z.string(),
      });
      const { refreshToken } = schema.parse(req.body);

      const result = await this.authService.refreshAccessToken(refreshToken);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  };

  public getSiweNonce = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        address: z.string(),
      });
      const { address } = schema.parse(req.body);

      const result = await this.authService.getNonce(address);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public verifySiwe = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        message: z.string(),
        signature: z.string(),
      });
      const { message, signature } = schema.parse(req.body);

      const result = await this.authService.verifySiwe(message, signature);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  };

  public updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(1),
      });
      const { email, name } = schema.parse(req.body);
      
      // req.user is populated by authenticate middleware
      const userId = (req as any).user.userId;

      const result = await this.authService.updateProfile(userId, email, name);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}

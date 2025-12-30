import { PaymentService } from './payment.service';
import prisma from '../config/database';
import redis from '../config/redis';

// Mock dependencies
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    gateway: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    setex: jest.fn(),
  },
}));

// Mock Viem
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    getTransaction: jest.fn(),
    getTransactionReceipt: jest.fn(),
  })),
  http: jest.fn(),
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService();
    jest.clearAllMocks();
  });

  describe('checkDuplicate', () => {
    it('should return true if payment exists in database', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });
      const result = await paymentService.checkDuplicate('0x123');
      expect(result).toBe(true);
    });

    it('should return false if payment does not exist', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await paymentService.checkDuplicate('0x123');
      expect(result).toBe(false);
    });
  });

  describe('verifyPayment', () => {
    it('should throw if gateway not found', async () => {
      (prisma.gateway.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(paymentService.verifyPayment('0x123', 'gw_id')).rejects.toThrow(
        'Gateway not found',
      );
    });

    it('should return valid payment if proof is valid', async () => {
      // Mock Gateway
      (prisma.gateway.findUnique as jest.Mock).mockResolvedValue({
        id: 'gw_123',
        pricePerRequest: '1.0',
        userId: 'user_123',
        user: { payoutWallet: '0xMM' },
        acceptedNetworks: ['base-usdc'],
      });

      // Mock Payment Check
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock Viem Transaction
      const mockTx = {
        hash: '0xabc',
        from: '0xSender',
        to: '0xMM', // Matches owner wallet
        value: BigInt(1000000), // 1 USDC (6 decimals)
        blockNumber: BigInt(100),
      };

      // Mock createPublicClient
      const mockGetTransaction = jest.fn().mockResolvedValue(mockTx);
      const mockGetTransactionReceipt = jest.fn().mockResolvedValue({ status: 'success' });

      const viem = require('viem');
      viem.createPublicClient.mockReturnValue({
        getTransaction: mockGetTransaction,
        getTransactionReceipt: mockGetTransactionReceipt,
      });

      // Mock Payment Creation
      const mockCreatedPayment = {
        id: 'pay_123',
        status: 'confirmed',
        amount: '1.0',
      };
      (prisma.payment.create as jest.Mock).mockResolvedValue(mockCreatedPayment);

      const result = await paymentService.verifyPayment('0xabc', 'gw_123');

      expect(result).toBeDefined();
      expect(result.id).toBe('pay_123');
      expect(result.status).toBe('confirmed');
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('should throw if payment already used', async () => {
      (prisma.gateway.findUnique as jest.Mock).mockResolvedValue({ id: 'gw_id' });
      // Mock checkDuplicate logic locally or integration
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(paymentService.verifyPayment('0x123', 'gw_id')).rejects.toThrow(
        'Payment already used',
      );
    });

    // Add more transaction validation tests here
  });
});

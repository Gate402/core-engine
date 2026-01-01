import { x402Facilitator } from '@x402/core/facilitator';
import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from '@x402/core/types';
import { toFacilitatorEvmSigner } from '@x402/evm';
import { registerExactEvmScheme } from '@x402/evm/exact/facilitator';
import dotenv from 'dotenv';
import express from 'express';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { PrismaClient } from '@prisma/client';

export interface ChainAsset {
  symbol: string;
  address: string;
  decimals: number;
}

export interface ChainConfig {
  id: string; // eip155:8453
  name: string;
  nativeCurrency: string;
  assets: {
    [symbol: string]: ChainAsset;
  };
}

dotenv.config();

const prisma = new PrismaClient();

// Configuration
const PORT = process.env.FACILITATOR_PORT || '4022';

// Validate required environment variables
if (!process.env.EVM_PRIVATE_KEY) {
  console.error('❌ EVM_PRIVATE_KEY environment variable is required');
  process.exit(1);
}
const main = async () => {
  // Load Configuration from Database
  console.log('🔄 Loading chain configuration from database...');
  const chains = await prisma.chain.findMany({
    include: { tokens: true },
  });

  const chainConfigs: Record<string, ChainConfig> = {};

  if (chains.length === 0) {
    console.warn('⚠️ No chains found in database! Facilitator may not work correctly.');
  }

  for (const chain of chains) {
    const assets: Record<string, ChainAsset> = {};
    for (const token of chain.tokens) {
      assets[token.symbol] = {
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals,
      };
    }

    chainConfigs[chain.id] = {
      id: chain.id,
      name: chain.name,
      nativeCurrency: chain.nativeCurrency,
      assets,
    };
  }

  console.log('✅ Loaded chain configuration:', Object.keys(chainConfigs).join(', '));

  // Initialize the EVM account from private key
  const evmAccount = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
  console.info(`EVM Facilitator account: ${evmAccount.address}`);

  const viemClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(),
  }).extend(publicActions);

  const evmSigner = toFacilitatorEvmSigner({
    getCode: (args: { address: `0x${string}` }) => viemClient.getCode(args),
    address: evmAccount.address,
    readContract: (args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) =>
      viemClient.readContract({
        ...args,
        args: args.args || [],
      }),
    verifyTypedData: (args: {
      address: `0x${string}`;
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
      signature: `0x${string}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) => viemClient.verifyTypedData(args as any),
    writeContract: (args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
    }) =>
      viemClient.writeContract({
        ...args,
        args: args.args || [],
      }),
    sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
      viemClient.sendTransaction(args),
    waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
      viemClient.waitForTransactionReceipt(args),
  });

  // Facilitator can now handle all Solana networks with automatic RPC creation

  const facilitator = new x402Facilitator()
    .onBeforeVerify(async (context) => {
      console.log('Before verify', context);
    })
    .onAfterVerify(async (context) => {
      console.log('After verify', context);
    })
    .onVerifyFailure(async (context) => {
      console.log('Verify failure', context);
    })
    .onBeforeSettle(async (context) => {
      console.log('Before settle', context);
    })
    .onAfterSettle(async (context) => {
      console.log('After settle', context);
    })
    .onSettleFailure(async (context) => {
      console.log('Settle failure', context);
    });

  // Register EVM and SVM schemes using dynamic DB config
  registerExactEvmScheme(facilitator, {
    signer: evmSigner,
    networks: Object.keys(chainConfigs) as `${string}:${string}`[],
  });

  // Initialize Express app
  const app = express();
  app.use(express.json());

  /**
   * POST /verify
   * Verify a payment against requirements
   */
  app.post('/verify', async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body as {
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };

      if (!paymentPayload || !paymentRequirements) {
        return res.status(400).json({
          error: 'Missing paymentPayload or paymentRequirements',
        });
      }

      const response: VerifyResponse = await facilitator.verify(
        paymentPayload,
        paymentRequirements,
      );

      res.json(response);
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /settle
   * Settle a payment on-chain
   */
  app.post('/settle', async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body;

      if (!paymentPayload || !paymentRequirements) {
        return res.status(400).json({
          error: 'Missing paymentPayload or paymentRequirements',
        });
      }

      const response: SettleResponse = await facilitator.settle(
        paymentPayload as PaymentPayload,
        paymentRequirements as PaymentRequirements,
      );

      res.json(response);
    } catch (error) {
      console.error('Settle error:', error);

      if (error instanceof Error && error.message.includes('Settlement aborted:')) {
        return res.json({
          success: false,
          errorReason: error.message.replace('Settlement aborted: ', ''),
          network: req.body?.paymentPayload?.network || 'unknown',
        } as SettleResponse);
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /supported
   * Get supported payment kinds and extensions
   */
  app.get('/supported', async (req, res) => {
    try {
      console.log('Getting supported...');
      const response = facilitator.getSupported();
      console.log(response);
      res.json(response);
    } catch (error) {
      console.error('Supported error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /config
   * Get chain configuration (assets, decimals, etc.) from DB
   */
  app.get('/config', (req, res) => {
    res.json(chainConfigs);
  });

  // Start the server
  app.listen(parseInt(PORT), () => {
    console.log('Facilitator listening');
  });
};
main();

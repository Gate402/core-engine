import { config } from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';
import { x402Client } from '@x402/core/client';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import type { PaymentRequirements } from '@x402/core/types';

config();

/**
 * Test Client for Gate402 x402 Integration
 *
 * Tests the payment flow:
 * 1. Make request without payment -> Get 402 with PAYMENT-REQUIRED header
 * 2. Decode requirements and create payment
 * 3. Retry with PAYMENT-SIGNATURE header -> Get 200 with PAYMENT-RESPONSE header
 */

const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const gatewayHost = process.env.GATEWAY_HOST || 'test-api.localhost';
const port = process.env.SERVER_PORT || '3030';
const baseURL = `http://${gatewayHost}:${port}`;

if (!evmPrivateKey) {
  console.error('❌ EVM_PRIVATE_KEY environment variable is required');
  console.error('Generate one with: openssl rand -hex 32');
  process.exit(1);
}

const evmSigner = privateKeyToAccount(evmPrivateKey);

// Select payment option (picks first available)
const selectPayment = (_version: number, requirements: PaymentRequirements[]) => {
  const selected = requirements[0];
  console.log(`🎯 Selected payment: ${selected.network} / ${selected.scheme} - ${selected.amount}`);
  return selected;
};

// Create x402 client with EVM scheme
const client = new x402Client(selectPayment).register('eip155:*', new ExactEvmScheme(evmSigner));

async function testPaymentFlow(path: string = '/') {
  const url = `${baseURL}${path}`;

  console.log(`\n🌐 Testing payment flow for: ${url}`);
  console.log(`   Host header: ${gatewayHost}\n`);

  // Step 1: Initial request (should get 402)
  console.log('📤 Step 1: Making initial request...');
  let response = await fetch(url);

  console.log(`📥 Response: ${response.status} ${response.statusText}\n`);

  if (response.status !== 402) {
    console.error('❌ Expected 402 Payment Required');
    console.error('Response:', await response.text());
    return;
  }

  // Step 2: Decode payment requirements
  const paymentRequiredHeader = response.headers.get('PAYMENT-REQUIRED');
  if (!paymentRequiredHeader) {
    console.error('❌ Missing PAYMENT-REQUIRED header');
    return;
  }

  console.log('📋 Step 2: Decoding payment requirements...');
  const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);
  console.log(paymentRequired);

  const requirements: PaymentRequirements[] = Array.isArray(paymentRequired.accepts)
    ? paymentRequired.accepts
    : [paymentRequired.accepts];

  console.log(`   Resource: ${paymentRequired.resource.url}`);
  console.log(`   Options: ${requirements.length}`);
  requirements.forEach((req, i) => {
    console.log(`     ${i + 1}. ${req.network} / ${req.scheme} - ${req.amount}`);
  });
  console.log();

  // Step 3: Create payment
  console.log('🔐 Step 3: Creating payment signature...');
  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const paymentHeader = encodePaymentSignatureHeader(paymentPayload);
  console.log('   ✅ Payment created\n');

  // Step 4: Retry with payment
  console.log('🔄 Step 4: Retrying with PAYMENT-SIGNATURE header...');
  console.log(paymentHeader);
  try {
    console.log('retrying');
    response = await fetch(url, {
      headers: {
        'PAYMENT-SIGNATURE': paymentHeader,
      },
    });
    console.log('hahahah');
    console.log(`📥 Response: ${response.status} ${response.statusText}\n`);
  } catch (error) {
    console.log(error);
    console.error('❌ Payment verification failed');
    console.error('Response:', await response.text());
    return;
  }

  console.log(`📥 Response: ${response.status} ${response.statusText}\n`);

  if (response.status !== 200) {
    console.error('❌ Payment verification failed');
    console.error('Response:', await response.text());
    return;
  }

  // Step 5: Success!
  console.log('✅ Step 5: Payment successful!\n');
  console.log('Response body:', await response.json());

  // Check for settlement header
  const settlementHeader = response.headers.get('PAYMENT-RESPONSE');
  if (settlementHeader) {
    const settlement = decodePaymentResponseHeader(settlementHeader);
    console.log('\n💰 Settlement details:');
    console.log(`   Transaction: ${settlement.transaction}`);
    console.log(`   Network: ${settlement.network}`);
    console.log(`   Payer: ${settlement.payer}`);
  } else {
    console.log('\n⚠️  No PAYMENT-RESPONSE header (settlement may be pending)');
  }

  console.log('\n🎉 Test completed successfully!');
}

async function main(): Promise<void> {
  console.log('\n🧪 Gate402 x402 Payment Flow Test\n');
  console.log('Configuration:');
  console.log(`  Server: ${baseURL}`);
  console.log(`  Gateway: ${gatewayHost}`);
  console.log(`  Wallet: ${evmSigner.address}\n`);

  await testPaymentFlow('/');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});

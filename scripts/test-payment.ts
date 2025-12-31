import { withPaymentInterceptor } from 'x402-axios';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const prisma = new PrismaClient();

const main = async () => {
  console.log('🔍 Finding a gateway to test...');
  const gateway = await prisma.gateway.findFirst({
    include: { user: true },
  });

  if (!gateway) {
    console.error('❌ No gateway found in database. Please create one first.');
    process.exit(1);
  }

  // Construct the URL using the gateway's subdomain
  // Assuming the server is running on localhost:3000 and handles subdomains via Host header
  const TARGET_HOST = `${gateway.subdomain}.localhost`;
  const TARGET_URL = `http://localhost:3000/`; // We hit localhost directly but send Host header

  console.log(`🎯 Target Gateway: ${gateway.subdomain}`);
  console.log(`   Price: ${gateway.pricePerRequest} USDC`);
  console.log(`   URL: ${TARGET_URL} (Host: ${TARGET_HOST})`);

  // --- Version 1: Without x402 (Expect 402 Payment Required) ---
  console.log('\n--- 🧪 Test 1: Request WITHOUT x402 headers ---');
  try {
    await axios.get(TARGET_URL, {
      headers: { Host: TARGET_HOST },
    });
    console.log('⚠️ Unexpected Success (200 OK) - Is the gateway free?');
  } catch (error: any) {
    if (error.response?.status === 402) {
      console.log('✅ Success: Received expected 402 Payment Required');
      console.log('   Challenge details:', error.response.data);
    } else {
      console.error('❌ Failed with unexpected error:', error.message);
    }
  }

  // --- Version 2: With x402 (Interceptor enabled) ---
  console.log('\n--- 🧪 Test 2: Request WITH x402 interceptor ---');

  // Generate a random wallet for the test (User would normally provide their own)
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log(`   👛 Using temporary wallet: ${account.address}`);

  // Create an axios instance with the interceptor
  // The interceptor handles the 402 response, signs the payment, and retries
  // @ts-ignore - x402-axios types are not fully exposed in this workspace
  const client = withPaymentInterceptor(axios.create(), {
    wallet: privateKey,
    rpcUrl: 'https://mainnet.base.org',
  } as any);

  try {
    const response = await client.get(TARGET_URL, {
      headers: { Host: TARGET_HOST },
    });
    console.log('✅ Payment Successful! Response:', response.data);
  } catch (error: any) {
    // Note: This is expected to fail if the wallet has no funds
    if (error.message?.includes('Insufficient funds') || error.response?.status === 402) {
      console.log('ℹ️ Interceptor worked but payment failed (Expected: No funds in test wallet)');
      console.log('   Error:', error.message);
    } else {
      console.error('❌ Request failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      }
    }
  }

  await prisma.$disconnect();
};

main();

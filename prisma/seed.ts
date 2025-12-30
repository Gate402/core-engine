import { PrismaClient } from '@prisma/client';
import { generatePrivateKey } from 'viem/accounts';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create a Test User
  const user = await prisma.user.upsert({
    where: { email: 'test@gate402.io' },
    update: {},
    create: {
      email: 'test@gate402.io',
      name: 'Test Gate402 User',
      payoutWallet: '0x1234567890123456789012345678901234567890', // Dummy
      payoutNetwork: 'base',
    },
  });
  console.log(`✅ User created/found: ${user.id}`);

  // 2. Create a Test Gateway
  // Random secret token
  const secretToken = `sk_test_${generatePrivateKey().slice(2, 34)}`;

  const gateway = await prisma.gateway.upsert({
    where: { subdomain: 'test-api' },
    update: {},
    create: {
      userId: user.id,
      subdomain: 'test-api', // Will result in test-api.localhost or test-api.gate402.io
      originUrl: 'https://jsonplaceholder.typicode.com/posts/1', // Good for testing, returns JSON
      pricePerRequest: 0.1, // 0.1 USDC
      acceptedNetworks: ['base-usdc'],
      status: 'active',
      secretToken: secretToken,
    },
  });
  console.log(`✅ Gateway created/found: ${gateway.subdomain}`);
  console.log(`   ID: ${gateway.id}`);
  console.log(`   Secret: ${gateway.secretToken}`);
  console.log(`   Price: ${gateway.pricePerRequest} USDC`);

  console.log('🌱 Seed finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

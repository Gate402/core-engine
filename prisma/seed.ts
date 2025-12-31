import { PrismaClient } from '@prisma/client';
import { generatePrivateKey } from 'viem/accounts';
import { CHAIN_CONFIGS } from '../src/config/chains';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 0. Seed Chains and Tokens
  for (const [chainId, config] of Object.entries(CHAIN_CONFIGS)) {
    const chain = await prisma.chain.upsert({
      where: { id: chainId },
      update: {
        name: config.name,
        nativeCurrency: config.nativeCurrency,
      },
      create: {
        id: chainId,
        name: config.name,
        nativeCurrency: config.nativeCurrency,
      },
    });
    console.log(`✅ Chain synced: ${chain.name} (${chain.id})`);

    for (const [symbol, asset] of Object.entries(config.assets)) {
      await prisma.token.upsert({
        where: {
          chainId_symbol: {
            chainId: chain.id,
            symbol: symbol,
          },
        },
        update: {
          address: asset.address,
          decimals: asset.decimals,
        },
        create: {
          chainId: chain.id,
          symbol: symbol,
          address: asset.address,
          decimals: asset.decimals,
        },
      });
    }
  }
  console.log('✅ Tokens synced');

  // 1. Create a Test User
  const user = await prisma.user.upsert({
    where: { email: 'jasonstanleyyoman@gmail.com' },
    update: {},
    create: {
      email: 'jasonstanleyyoman@gmail.com',
      name: 'Test Gate402 User',
    },
  });
  console.log(`✅ User created/found: ${user.id}`);

  // 2. Create a Test Gateway
  // Point this to your local x402 server (e.g. scripts/custom-402.ts on port 4021)
  const secretToken = `sk_test_${generatePrivateKey().slice(2, 34)}`;
  const testEvmAddress = process.env.EVM_ADDRESS || '0x0057966BcDd185DfcF44fCB64a948b26338701E7';

  const gateway = await prisma.gateway.upsert({
    where: { subdomain: 'test-api' },
    update: {
      originUrl: 'http://localhost:4021/weather',
      defaultPricePerRequest: 0.001,
      paymentNetwork: 'eip155:84532',
      evmAddress: testEvmAddress,
    },
    create: {
      userId: user.id,
      subdomain: 'test-api',
      originUrl: 'http://localhost:4021/weather',
      defaultPricePerRequest: 0.001,
      acceptedNetworks: ['eip155:84532'],
      status: 'active',
      secretToken: secretToken,
      paymentScheme: 'exact',
      paymentNetwork: 'eip155:84532',
      evmAddress: testEvmAddress,
    },
  });
  console.log(`✅ Gateway created/found: ${gateway.subdomain}`);
  console.log(`   ID: ${gateway.id}`);
  console.log(`   Target: ${gateway.originUrl}`);
  console.log(`   Secret: ${gateway.secretToken}`);
  console.log(`   Price: $${gateway.defaultPricePerRequest}`);
  console.log(`   Payment Address: ${gateway.evmAddress}`);

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

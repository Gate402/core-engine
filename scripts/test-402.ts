import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { x402HTTPClient, x402Client } from '@x402/core/client';
import { x402HTTPResourceServer } from '@x402/core/http';
import { ExactEvmScheme } from '@x402/evm/exact/server';

// Connect to facilitator
const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator',
});

// Create resource server with payment schemes
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  'eip155:*',
  new ExactEvmScheme(),
);
const main = async () => {
  const result = await facilitatorClient.getSupported();
  // console.log(result);
  await resourceServer.initialize();
  const paymentRequirements = await resourceServer.buildPaymentRequirements({
    network: 'eip155:84532',
    scheme: 'exact',
    payTo: '0xYourAddress',
    price: '$0.01',
  });

  const response = resourceServer.createPaymentRequiredResponse(paymentRequirements, {
    description: 'Access to premium content',
    mimeType: 'application/json',
    url: '/protected-route',
  });

  // console.log(btoa(JSON.stringify(response)));

  // const client = new x402Client().register('eip155:*', new ExactEvmScheme());
  // client.createPaymentPayload(paymentRequirements[0]);
  // const httpClient = new x402HTTPClient({});
  // console.log(paymentRequirements);
};

// Configure routes with payment requirements
// const routes = {
//   'GET /api/data': {
//     accepts: {
//       scheme: 'exact',
//       network: 'eip155:8453',
//       payTo: '0xYourAddress',
//       price: '$0.01',
//     },
//     description: 'Premium data access',
//     mimeType: 'application/json',
//   },
// };

// resourceServer.buildPaymentRequirements({
//   scheme: 'exact',
//   network: 'eip155:8453',
//   payTo: '0xYourAddress',
//   price: '$0.01',
// });
// // Create HTTP server wrapper
// const httpServer = new x402HTTPResourceServer(resourceServer, {
//   'GET /': {
//     accepts: {
//       scheme: 'exact',
//       network: 'eip155:8453',
//       payTo: '0xYourAddress',
//       price: '$0.01',
//     },
//     description: 'Premium data access',
//     mimeType: 'application/json',
//   },
// });

main();

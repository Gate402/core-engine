import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

const app = express();

const facilitatorClient = new HTTPFacilitatorClient({ url: 'https://x402.org/facilitator' });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  'eip155:84532',
  new ExactEvmScheme(),
);
resourceServer.onVerifyFailure(async (ctx) => {
  console.log(ctx);
  console.log('debug');
});

// Apply the payment middleware with your configuration
app.use(
  paymentMiddleware(
    {
      'GET /protected-route': {
        accepts: {
          scheme: 'exact',
          price: '$0.10',
          network: 'eip155:84532',
          payTo: '0xYourAddress',
        },
        description: 'Access to premium content',
        mimeType: 'application/json',
      },
    },
    resourceServer,
  ),
);

app.get('/', (req, res) => {
  console.log('debug');
  res.json({ message: 'This content is behind a paywall' });
});

// Implement your protected route
app.get('/protected-route', (req, res) => {
  res.json({ message: 'This content is behind a paywall' });
});

app.listen(3000);

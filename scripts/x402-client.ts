import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';
const main = async () => {
  const randomPK = crypto.randomBytes(32);
  const account = privateKeyToAccount(('0x' + randomPK.toString('hex')) as `0x${string}`);
  // Create core client and register payment schemes
  const coreClient = new x402Client().register('eip155:*', new ExactEvmScheme(account));

  // Wrap with HTTP client for header encoding/decoding
  const client = new x402HTTPClient(coreClient);

  // Make a request
  const response = await fetch('http://localhost:3000/protected-route');

  if (response.status === 402) {
    console.log(response.headers);
    console.log(await response.json());
    // Extract payment requirements from response
    // const paymentRequired = client.getPaymentRequiredResponse(
    //   (name) => response.headers.get(name),
    //   await response.json(),
    // );

    // // Create and send payment
    // const paymentPayload = await client.createPaymentPayload(paymentRequired);

    // const paidResponse = await fetch('https://api.example.com/protected', {
    //   headers: client.encodePaymentSignatureHeader(paymentPayload),
    // });

    // // Get settlement confirmation
    // const settlement = client.getPaymentSettleResponse((name) => paidResponse.headers.get(name));
    // console.log('Transaction:', settlement.transaction);
  }
};
main();

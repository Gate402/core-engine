import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import axios from 'axios';

// Configuration
const API_URL = 'http://localhost:3000/api/auth'; 
// Assuming the server is running on port 3000. 
// If not, I might need to check or ask. The package.json says "start": "bun dist/src/index.js".
// Usually defaults to 3000 or 8080.
// I'll assume 3000 for now or check source code if this fails.

async function main() {
  console.log('Starting SIWE Verification Flow...');

  // 1. Generate Wallet
  const privateKey = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http()
  });

  console.log(`Generated Wallet: ${account.address}`);

  // 2. Request Nonce
  console.log('Requesting Nonce...');
  try {
    const nonceRes = await axios.post(`${API_URL}/siwe/nonce`, {
      address: account.address
    });
    const { nonce } = nonceRes.data;
    console.log(`Received Nonce: ${nonce}`);

    // 3. Create SIWE Message
    // Simple format for now as per my implementation
    const message = `Sign in with Ethereum to Gate402\nNonce: ${nonce}`;
    console.log(`Message to sign:\n${message}`);

    // 4. Sign Message
    const signature = await client.signMessage({
      message
    });
    console.log(`Signature: ${signature}`);

    // 5. Verify SIWE
    console.log('Verifying SIWE...');
    const verifyRes = await axios.post(`${API_URL}/siwe/verify`, {
      message,
      signature
    });

    console.log('Verification Response:', verifyRes.data);
    
    if (verifyRes.data.tokens && verifyRes.data.tokens.accessToken) {
        console.log('SUCCESS: Access Token received!');
        
        // 6. Update Profile
        console.log('Updating Profile...');
        const accessToken = verifyRes.data.tokens.accessToken;
        const profileRes = await axios.post(`${API_URL}/siwe/complete-profile`, {
            email: `user_${Date.now()}@example.com`,
            name: 'SIWE User'
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        
        console.log('Profile Update Response:', profileRes.data);
        if (profileRes.data.user.email.includes('example.com')) {
             console.log('SUCCESS: Profile updated!');
        } else {
             console.error('FAILURE: Profile not updated correctly.');
             process.exit(1);
        }

    } else {
        console.error('FAILURE: No access token received.');
        process.exit(1);
    }

  } catch (error: any) {
    console.error('Error during flow:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();

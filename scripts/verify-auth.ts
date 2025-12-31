import axios from 'axios';

const API_URL = 'http://localhost:3000/api/auth';

async function testAuthFlow() {
  const email = 'test@example.com';

  console.log('--- Starting Auth Flow Verification ---');

  // 1. Request OTP
  console.log(`\n1. Requesting OTP for ${email}...`);
  try {
    await axios.post(`${API_URL}/otp/request`, { email });
    console.log('✅ OTP Requested successfully. Check console logs for OTP.');
  } catch (error: any) {
    console.error('❌ Failed to request OTP:', error.response?.data || error.message);
    return;
  }

  console.log('\n!!! Check the server logs for the OTP !!!');
  console.log('Then verify it using curl or Postman:');
  console.log(
    `curl -X POST ${API_URL}/otp/verify -H "Content-Type: application/json" -d '{"email": "${email}", "otp": "YOUR_OTP"}'`,
  );
}

testAuthFlow();

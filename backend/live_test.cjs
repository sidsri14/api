const axios = require('axios');
const crypto = require('crypto');

const API_BASE = 'http://localhost:3000/api';
const SECRET = 'mock_webhook_secret';
const EMAIL = `live-test-${Date.now()}@example.com`;
const PASSWORD = 'Password123!';

async function runTest() {
  try {
    console.log('--- Phase 1: Registration ---');
    // Get CSRF Token
    const csrfRes = await axios.get(`${API_BASE.replace('/api', '')}/api/csrf-token`);
    const csrfToken = csrfRes.data.token;
    const sessionCookie = csrfRes.headers['set-cookie'];

    // Register
    const regRes = await axios.post(`${API_BASE}/auth/register`, 
      { email: EMAIL, password: PASSWORD },
      { headers: { 'x-csrf-token': csrfToken, Cookie: sessionCookie } }
    );
    console.log('Registration Success:', regRes.data.success);
    const authHeaders = { Cookie: regRes.headers['set-cookie'], 'x-csrf-token': csrfToken };

    console.log('\n--- Phase 2: Initial Dashboard Check ---');
    const initStats = await axios.get(`${API_BASE}/dashboard/stats`, { headers: authHeaders });
    console.log('Initial Recovery Rate:', initStats.data.data.recoveryRate, '%');

    console.log('\n--- Phase 3: Simulate Failed Payment Webhook ---');
    const paymentId = `pay_live_${Math.floor(Math.random() * 10000)}`;
    const failPayload = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: 50000,
            currency: 'INR',
            email: EMAIL,
            contact: '+919999999999',
            order_id: 'order_live_abc',
            notes: { name: 'Live User' }
          }
        }
      }
    });
    const sig = crypto.createHmac('sha256', SECRET).update(failPayload).digest('hex');
    await axios.post(`${API_BASE}/webhook/razorpay`, failPayload, {
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }
    });
    console.log('Webhook Sent: payment.failed');

    // Wait for async processing
    console.log('Waiting for background processing...');
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n--- Phase 4: Intermediate Dashboard Check ---');
    const midStats = await axios.get(`${API_BASE}/dashboard/stats`, { headers: authHeaders });
    console.log('Status Refresh - Found Payments:', midStats.data.data.totalFound);

    console.log('\n--- Phase 5: Simulate Successful Recovery ---');
    const successPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: 50000,
            currency: 'INR',
            email: EMAIL
          }
        }
      }
    });
    const sig2 = crypto.createHmac('sha256', SECRET).update(successPayload).digest('hex');
    await axios.post(`${API_BASE}/webhook/razorpay`, successPayload, {
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig2 }
    });
    console.log('Webhook Sent: payment.captured');

    await new Promise(r => setTimeout(r, 2000));

    console.log('\n--- Phase 6: Final Dashboard Verification ---');
    const finalStats = await axios.get(`${API_BASE}/dashboard/stats`, { headers: authHeaders });
    console.log('Final Recovery Rate:', finalStats.data.data.recoveryRate, '%');
    console.log('Recovered Amount:', finalStats.data.data.totalRecoveredAmount);

    if (finalStats.data.data.recoveryRate === 100) {
      console.log('\n✅ TEST PASSED: End-to-End recovery flow is functional.');
      console.log(`Credentials for manual login: ${EMAIL} / ${PASSWORD}`);
    } else {
      console.log('\n❌ TEST FAILED: Recovery rate mismatch.');
    }

  } catch (err) {
    console.error('\n❌ TEST ERROR:', err.response ? err.response.data : err.message);
  }
}

runTest();

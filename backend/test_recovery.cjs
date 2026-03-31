const axios = require('axios');
const crypto = require('crypto');

// --- Configuration ---
const API_BASE = 'http://localhost:3000/api';
const EMAIL = `test-${Date.now()}@payrecover.com`;
const PASSWORD = 'Password123!';
const WEBHOOK_SECRET = 'recovery_test_secret';

const axiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

async function runTest() {
  try {
    console.log('--- Phase 1: Registration & CSRF ---');
    // Get CSRF Token
    const csrfRes = await axios.get('http://localhost:3000/api/csrf-token');
    const csrfToken = csrfRes.data.token;
    const sessionCookie = csrfRes.headers['set-cookie'];

    const headers = { 
        'x-csrf-token': csrfToken, 
        Cookie: sessionCookie?.join('; ') 
    };

    // Register
    const regRes = await axiosInstance.post('/auth/register', 
      { email: EMAIL, password: PASSWORD },
      { headers }
    );
    console.log('✅ Registration Success');
    
    // Auth Headers for subsequent requests
    // Important: Merge the new Auth cookie with the previous CSRF cookie
    const cookies = [
        ...(sessionCookie || []),
        ...(regRes.headers['set-cookie'] || [])
    ];
    
    const authHeaders = { 
        'x-csrf-token': csrfToken, 
        Cookie: cookies.join('; ') 
    };

    console.log('\n--- Phase 2: Create Payment Source ---');
    const sourceRes = await axiosInstance.post('/sources/connect', {
      keyId: 'rzp_test_mock',
      keySecret: 'mock_secret',
      webhookSecret: WEBHOOK_SECRET,
      name: 'Test Source'
    }, { headers: authHeaders });

    console.log('--- DBG Info ---');
    console.log('Source Response Body:', JSON.stringify(sourceRes.data));
    
    const sourceId = sourceRes.data.data.id;
    console.log(`✅ Payment Source Created: ${sourceId}`);

    console.log('\n--- Phase 3: Simulate Failed Payment ---');
    const paymentId = `pay_${Math.floor(Math.random() * 1000000)}`;
    const failPayload = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: 150000,
            currency: 'INR',
            email: EMAIL,
            contact: '+919876543210',
            order_id: 'order_abc_123',
            notes: { name: 'Test Customer' }
          }
        }
      }
    });

    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(failPayload).digest('hex');
    
    // Note: /api/webhooks/razorpay is correct from app.ts
    await axios.post(`http://localhost:3000/api/webhooks/razorpay/${sourceId}`, failPayload, {
      headers: { 
          'Content-Type': 'application/json', 
          'x-razorpay-signature': signature 
      }
    });
    console.log('✅ Webhook sent: payment.failed');

    console.log('Waiting for processing...');
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n--- Phase 4: Intermediate Stats Verification ---');
    const midStats = await axiosInstance.get('/dashboard/stats', { headers: authHeaders });
    console.log(`Total Found: ${midStats.data.data.totalFound}`);
    console.log(`Recovery Rate: ${midStats.data.data.recoveryRate}%`);

    console.log('\n--- Phase 5: Simulate Recovery (payment.captured) ---');
    const successPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: 150000,
            currency: 'INR',
            email: EMAIL
          }
        }
      }
    });

    const signature2 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(successPayload).digest('hex');
    await axios.post(`http://localhost:3000/api/webhooks/razorpay/${sourceId}`, successPayload, {
      headers: { 
          'Content-Type': 'application/json', 
          'x-razorpay-signature': signature2 
      }
    });
    console.log('✅ Webhook sent: payment.captured');

    console.log('Waiting for processing...');
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n--- Phase 6: Final Verification ---');
    const finalStats = await axiosInstance.get('/dashboard/stats', { headers: authHeaders });
    console.log(`Final Recovery Rate: ${finalStats.data.data.recoveryRate}%`);
    console.log(`Total Recovered Amount: ${finalStats.data.data.totalRecoveredAmount}`);

    if (finalStats.data.data.recoveryRate === 100) {
      console.log('\n🌟 SUCCESS: The entire recovery flow is functional!');
    } else {
      console.error('\n❌ FAILURE: Recovery flow did not result in 100% recovery rate.');
      process.exit(1);
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

runTest();

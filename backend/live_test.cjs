/**
 * PayRecover end-to-end integration test.
 * Tests: register → add source → simulate webhook → verify recovery.
 *
 * Run:  node live_test.cjs
 * Requires the server to be running on http://localhost:3000
 *
 * Each run creates a unique test user and cleans it up via DELETE /api/auth/me
 * (if that endpoint exists) or via direct DB delete (Prisma cascade handles the rest).
 * A unique email per run ensures no collision between test runs.
 */
const axios = require('axios');
const crypto = require('crypto');

const BASE = 'http://localhost:3000';
const API = `${BASE}/api`;
const EMAIL = `live-test-${Date.now()}@example.com`;
const PASSWORD = 'Password123!';

// Plain-text secrets used to sign outgoing webhooks.
// The server encrypts them on storage; we sign with the plain-text secret here.
const TEST_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxx';
const TEST_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'xxxx';
const TEST_WEBHOOK_SECRET = 'test_webhook_secret_' + Date.now();

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function run() {
  let authHeaders;
  let sourceId;

  try {
    // ── 1. CSRF token
    const csrfRes = await axios.get(`${API}/csrf-token`);
    const csrfToken = csrfRes.data.token;
    const csrfCookie = csrfRes.headers['set-cookie'];

    // ── 2. Register
    console.log('1. Registering user...');
    const regRes = await axios.post(`${API}/auth/register`,
      { email: EMAIL, password: PASSWORD },
      { headers: { 'x-csrf-token': csrfToken, Cookie: csrfCookie } }
    );
    const authCookie = regRes.headers['set-cookie'];
    authHeaders = { Cookie: authCookie, 'x-csrf-token': csrfToken };
    console.log('   ✓ Registered:', EMAIL);

    // ── 3. Add a PaymentSource (required — webhook URL includes sourceId)
    console.log('2. Adding PaymentSource...');
    const sourceRes = await axios.post(`${API}/sources/connect`,
      { keyId: TEST_KEY_ID, keySecret: TEST_KEY_SECRET, webhookSecret: TEST_WEBHOOK_SECRET, name: 'Live Test Source' },
      { headers: authHeaders }
    );
    sourceId = sourceRes.data.data.id;
    console.log('   ✓ Source created:', sourceId);

    // ── 4. Initial dashboard state
    const initStats = await axios.get(`${API}/dashboard/stats`, { headers: authHeaders });
    console.log('3. Initial state — total failed:', initStats.data.data.totalFailed);

    // ── 5. Send payment.failed webhook to /api/webhooks/razorpay/:sourceId
    console.log('4. Sending payment.failed webhook...');
    const paymentId = `pay_live_${crypto.randomBytes(4).toString('hex')}`;
    const failPayload = JSON.stringify({
      event: 'payment.failed',
      account_id: 'acc_test',
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: 99900,
            currency: 'INR',
            email: EMAIL,
            contact: '+919999999999',
            order_id: 'order_live_test',
            status: 'failed',
            notes: { name: 'Live Test User' },
          },
        },
      },
    });
    await axios.post(`${API}/webhooks/razorpay/${sourceId}`, failPayload, {
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sign(failPayload, TEST_WEBHOOK_SECRET) },
    });
    console.log('   ✓ payment.failed sent for', paymentId);

    // Wait for async processing
    await new Promise(r => setTimeout(r, 500));

    const midStats = await axios.get(`${API}/dashboard/stats`, { headers: authHeaders });
    console.log('5. After failure — total failed:', midStats.data.data.totalFailed);
    if (midStats.data.data.totalFailed !== 1) {
      throw new Error('Expected totalFailed = 1, got ' + midStats.data.data.totalFailed);
    }

    // ── 6. Send payment.captured webhook (simulates customer paying via recovery link)
    console.log('6. Sending payment.captured webhook...');
    const capturePayload = JSON.stringify({
      event: 'payment.captured',
      account_id: 'acc_test',
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: 99900,
            currency: 'INR',
            email: EMAIL,
            order_id: 'order_live_test',
            status: 'captured',
          },
        },
      },
    });
    await axios.post(`${API}/webhooks/razorpay/${sourceId}`, capturePayload, {
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sign(capturePayload, TEST_WEBHOOK_SECRET) },
    });
    console.log('   ✓ payment.captured sent');

    await new Promise(r => setTimeout(r, 500));

    // ── 7. Verify recovery
    const finalStats = await axios.get(`${API}/dashboard/stats`, { headers: authHeaders });
    const { totalFailed, totalRecovered, recoveryRate } = finalStats.data.data;
    console.log('7. Final — failed:', totalFailed, '| recovered:', totalRecovered, '| rate:', recoveryRate + '%');

    if (totalRecovered === 1 && recoveryRate === 100) {
      console.log('\n✅ TEST PASSED — end-to-end recovery flow is functional.');
    } else {
      console.error('\n❌ TEST FAILED — unexpected final state.');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ TEST ERROR:', err.response?.data ?? err.message);
    process.exit(1);
  } finally {
    // ── 8. Cleanup — delete the test user (cascades to sources, payments, events)
    //    This keeps test runs idempotent and the DB clean.
    //    Uses a direct Prisma delete via a lightweight cleanup script.
    //    If you need to inspect the test data, comment this block out.
    if (authHeaders) {
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.user.deleteMany({ where: { email: EMAIL } });
        await prisma.$disconnect();
        console.log('8. Cleanup — test user deleted.');
      } catch (cleanupErr) {
        // Non-fatal: test passed, cleanup is best-effort
        console.warn('   ⚠ Cleanup skipped (not fatal):', cleanupErr.message);
      }
    }
  }
}

run();

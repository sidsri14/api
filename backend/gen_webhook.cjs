const crypto = require('crypto');
const secret = 'mock_webhook_secret';
const payload = JSON.stringify({
  event: 'payment.failed',
  payload: {
    payment: {
      entity: {
        id: 'pay_test_12345',
        amount: 50000,
        currency: 'INR',
        email: 'user1@example.com',
        contact: '+919999999999',
        order_id: 'order_test_abcde',
        notes: { name: 'User One' }
      }
    }
  }
});
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log(JSON.stringify({ payload, signature }));

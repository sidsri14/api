import Razorpay from 'razorpay';
import crypto from 'crypto';
import { BaseProvider, PaymentEventData } from './BaseProvider.js';

export class RazorpayProvider extends BaseProvider {
  private getRazorpay(keyId: string, keySecret: string): Razorpay {
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async validateCredentials(credentials: any): Promise<boolean> {
    try {
      const { keyId, keySecret } = credentials;
      const rzp = this.getRazorpay(keyId, keySecret);
      await rzp.payments.all({ count: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async generateRecoveryLink(failedPayment: any, source: any): Promise<string | null> {
    const { credentials } = source;
    const creds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
    const { keyId, keySecret } = creds;

    // Audit-friendly mock for environments with placeholder keys
    if (keyId?.includes('placeholder') || !keyId) {
      return `https://rzp.io/i/mock_recovery_${failedPayment.id}`;
    }

    const rzp = this.getRazorpay(keyId, keySecret);
    const expireBy = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    try {
      const link = await (rzp.paymentLink.create({
        amount: failedPayment.amount,
        currency: failedPayment.currency || 'INR',
        description: `Recover failed payment #${failedPayment.paymentId}`,
        notify: { email: false, sms: false },
        reminder_enable: false,
        reference_id: failedPayment.id,
        expire_by: expireBy,
        customer: {
          name: failedPayment.customerName || 'Customer',
          email: failedPayment.customerEmail,
          contact: failedPayment.customerPhone || undefined
        },
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-status`,
        callback_method: 'get'
      }) as Promise<any>);
      return link.short_url;
    } catch (err) {
      console.error('[RazorpayProvider] Failed to create payment link:', err);
      return null;
    }
  }

  async verifyWebhookSignature(body: any, signature: string, webhookSecret: string): Promise<boolean> {
    try {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(typeof body === 'string' ? body : JSON.stringify(body));
      const digest = shasum.digest('hex');
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch (err) {
      return false;
    }
  }

  parseWebhook(body: any): PaymentEventData | null {
    try {
      const event = body.event;
      const payload = body.payload;

      // Handle failed payments
      if (event === 'payment.failed') {
        const payment = payload.payment.entity;
        return {
          providerEventId: body.id,
          eventType: 'payment.failed',
          paymentId: payment.id,
          orderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          customerEmail: payment.email,
          customerPhone: payment.contact,
          status: 'failed',
          rawData: JSON.stringify(body),
        };
      }

      // Handle captured payments (recovery success)
      if (event === 'payment.captured' || event === 'payment.authorized') {
        const payment = payload.payment.entity;
        return {
          providerEventId: body.id,
          eventType: 'payment.captured',
          paymentId: payment.id,
          orderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          customerEmail: payment.email,
          customerPhone: payment.contact,
          status: 'captured',
          rawData: JSON.stringify(body),
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}

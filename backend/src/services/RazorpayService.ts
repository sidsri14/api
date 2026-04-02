import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize with environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

/**
 * Service for interacting with Razorpay API and verifying webhooks.
 * Day 1-2 of MVP Roadmap Implementation.
 */
export class RazorpayService {
  /**
   * Verifies the authenticity of a Razorpay webhook signature.
   */
  static async verifyWebhookSignature(body: any, signature: string, webhookSecret: string): Promise<boolean> {
    try {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(typeof body === 'string' ? body : JSON.stringify(body));
      const digest = shasum.digest('hex');
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch (err) {
      return false;
    }
  }

  /**
   * Creates a 7-day payment link for a failed payment.
   */
  static async createPaymentLink(failedPayment: any): Promise<string> {
    // Expiration: 7 days from now (in seconds)
    const expireBy = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    const link = await (razorpay.paymentLink.create({
      amount: failedPayment.amount,           // already in paise
      currency: failedPayment.currency || 'INR',
      description: `Recover failed payment #${failedPayment.paymentId}`,
      notify: { email: false, sms: false },   // we send our own emails
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
  }

  /**
   * Fetches full details for a specific payment.
   */
  static async getPaymentStatus(paymentId: string) {
    return razorpay.payments.fetch(paymentId);
  }

  /**
   * Creates a new Razorpay subscription for the platform.
   * This is used for 'PayRecover Starter' and 'PayRecover Pro' billing.
   */
  static async createRazorpaySubscription(data: any) {
    return (razorpay.subscriptions.create(data) as Promise<any>);
  }
}

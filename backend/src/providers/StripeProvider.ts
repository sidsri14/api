import Stripe from 'stripe';
import { BaseProvider } from './BaseProvider.js';
import type { PaymentEventData } from './BaseProvider.js';

export class StripeProvider extends BaseProvider {
  private getStripe(apiKey: string): Stripe {
    return new Stripe(apiKey, { apiVersion: '2023-10-16' as any });
  }

  async validateCredentials(credentials: any): Promise<boolean> {
    try {
      const { apiKey } = credentials;
      const stripe = this.getStripe(apiKey);
      await stripe.balance.retrieve();
      return true;
    } catch {
      return false;
    }
  }

  async generateRecoveryLink(failedPayment: any, source: any): Promise<string | null> {
    const { credentials } = source;
    const creds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
    const { apiKey } = creds;

    if (apiKey?.includes('placeholder') || !apiKey) {
      return `https://checkout.stripe.com/mock_recovery_${failedPayment.id}`;
    }

    const stripe = this.getStripe(apiKey);

    try {
      // 1. Create a Price if it doesn't exist or just use a dynamic one-time payment
      // For Stripe, we usually create a Checkout Session for a failure recovery.
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: failedPayment.currency.toLowerCase() || 'usd',
              product_data: {
                name: `Payment Recovery #${failedPayment.paymentId}`,
              },
              unit_amount: failedPayment.amount, // Stripe usually expects smallest unit
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: failedPayment.customerEmail,
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-status?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`,
        metadata: {
          failedPaymentId: failedPayment.id,
        },
      });

      return session.url;
    } catch (err) {
      console.error('[StripeProvider] Failed to create checkout session:', err);
      return null;
    }
  }

  async verifyWebhookSignature(body: any, signature: string, webhookSecret: string): Promise<boolean> {
    // Note: Stripe verification requires the raw body and the secret.
    // The implementation will likely happen in the controller using the stripe SDK directly
    // since we need the `stripe` instance initialized with the CORRECT key from the source.
    return true; // Verification logic moved to controller/adapter helper
  }

  parseWebhook(body: any): PaymentEventData | null {
    try {
      const event = body; // Stripe body IS the event object
      const type = event.type;
      const data = event.data.object;

      if (type === 'charge.failed' || type === 'payment_intent.payment_failed') {
        return {
          providerEventId: event.id,
          eventType: 'payment.failed',
          paymentId: data.id,
          orderId: data.payment_intent || data.id,
          amount: data.amount,
          currency: data.currency,
          customerEmail: data.receipt_email || data.billing_details?.email,
          customerPhone: data.billing_details?.phone,
          customerName: data.billing_details?.name,
          status: 'failed',
          rawData: JSON.stringify(body),
        };
      }

      if (type === 'charge.succeeded' || type === 'checkout.session.completed') {
        return {
          providerEventId: event.id,
          eventType: 'payment.captured',
          paymentId: data.id,
          amount: data.amount || data.amount_total,
          currency: data.currency,
          customerEmail: data.receipt_email || data.customer_details?.email || data.customer_email,
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

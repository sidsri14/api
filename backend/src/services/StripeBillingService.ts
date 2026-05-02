import Stripe from 'stripe';
import { prisma } from '../utils/prisma.js';
import { logAuditAction } from '../services/audit.service.js';

let _stripe: Stripe | null = null;
const getStripe = () => {
  const secret = process.env.STRIPE_PLATFORM_SECRET_KEY;
  const isMockKey = !secret || secret.includes('xxxx');

  if (isMockKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Stripe] STRIPE_PLATFORM_SECRET_KEY is not configured. Refusing to use mock in production.');
    }
    console.warn('[STRIPE MOCK] STRIPE_PLATFORM_SECRET_KEY is missing or dummy. Returning mock (dev only).');
    return {
      checkout: {
        sessions: {
          create: async (params: any) => ({
            id: 'mock_session_' + Math.random().toString(36).slice(7),
            url: (params.success_url || '').replace('{CHECKOUT_SESSION_ID}', 'mock_session_id'),
          })
        }
      },
      webhooks: {
        constructEvent: () => { throw new Error('Mock cannot verify real webhook signatures'); }
      }
    } as any;
  }

  if (!_stripe) {
    _stripe = new Stripe(secret, {
      apiVersion: '2023-10-16' as any,
    });
  }
  return _stripe;
};

const PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
} as const;

export class StripeBillingService {
  /**
   * Creates a Stripe Checkout Session for a plan.
   */
  static async createCheckoutSession(userId: string, plan: 'starter' | 'pro') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { status: 404, message: 'User not found' };

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      throw { status: 500, message: `Stripe Price ID for '${plan}' is not configured on the server.` };
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?status=cancel`,
      metadata: {
        userId,
        plan,
      },
    });

    // We save a "pending" subscription record
    await prisma.subscription.create({
      data: {
        userId,
        providerSubscriptionId: session.id, // Temporary until authenticated
        plan,
        status: 'created',
      },
    });

    void logAuditAction(userId, 'BILLING_CHECKOUT_CREATE', 'Subscription', session.id, { plan });
    return {
      id: session.id,
      checkoutUrl: session.url,
    };
  }

  /**
   * Creates a Stripe Checkout Session for a specific invoice.
   */
  static async createInvoiceSession(invoice: any, user: any, successUrl?: string, cancelUrl?: string) {
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: invoice.clientEmail,
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: {
              name: invoice.description,
              description: `Invoice from ${user.name || user.email}`,
            },
            unit_amount: invoice.amount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl || `${frontendBase}/dashboard?status=paid&invoice_id=${invoice.id}`,
      cancel_url: cancelUrl || `${frontendBase}/dashboard?status=cancelled`,
      metadata: {
        userId: user.id,
        invoiceId: invoice.id,
        type: 'invoice'
      },
    });

    return {
      id: session.id,
      checkoutUrl: session.url,
    };
  }

  /**
   * Handle Stripe platform webhooks (subscription lifecycle).
   */
  static async handleWebhook(event: Stripe.Event) {
    const data = event.data.object as any;

    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = data.metadata?.userId;
        const plan = data.metadata?.plan;
        
        if (userId && plan) {
          // Find the pending subscription and update it
          await prisma.subscription.updateMany({
            where: { providerSubscriptionId: data.id, userId },
            data: {
              status: 'active',
              providerSubscriptionId: data.subscription, // Replace session ID with actual subscription ID
            },
          });

          // Upgrade user
          await prisma.user.update({
            where: { id: userId },
            data: { plan },
          });
          void logAuditAction(userId, 'BILLING_UPGRADE_SUCCESS', 'Subscription', data.subscription, { plan });
        }

        // Handle one-off invoice payments
        const invoiceId = data.metadata?.invoiceId;
        const type = data.metadata?.type;

        if (type === 'invoice' && invoiceId) {
          await prisma.invoice.updateMany({
            where: { id: invoiceId, status: { not: 'PAID' } },
            data: { status: 'PAID', paidAt: new Date() },
          });
          const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
          if (invoice) void logAuditAction(invoice.userId, 'INVOICE_PAY_SUCCESS', 'Invoice', invoiceId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscriptionId = data.id;
        const subRecord = await prisma.subscription.findUnique({
          where: { providerSubscriptionId: subscriptionId },
        });

        if (subRecord) {
          await prisma.subscription.update({
            where: { id: subRecord.id },
            data: { status: 'cancelled', cancelledAt: new Date() },
          });

          await prisma.user.update({
            where: { id: subRecord.userId },
            data: { plan: 'free' },
          });
          void logAuditAction(subRecord.userId, 'BILLING_CANCEL', 'Subscription', subscriptionId);
        }
        break;
      }
    }
  }

  static async verifyWebhookSignature(body: Buffer, signature: string) {
    const secret = process.env.STRIPE_PLATFORM_WEBHOOK_SECRET || '';
    return getStripe().webhooks.constructEvent(body, signature, secret);
  }
}

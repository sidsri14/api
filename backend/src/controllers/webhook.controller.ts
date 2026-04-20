import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../utils/prisma.js';
import { sendReceiptEmail } from '../lib/resend.js';

function getStripe() {
  return new Stripe(process.env.STRIPE_PLATFORM_SECRET_KEY!, { apiVersion: '2023-10-16' as any });
}

export const handleUnifiedWebhook = async (req: Request, res: Response) => {
  const { provider } = req.params;
  res.status(200).json({ received: true, provider });
};

export const handleStripeInvoiceWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_INVOICE_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'STRIPE_INVOICE_WEBHOOK_SECRET not configured' });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, sig as string, secret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;
    if (invoiceId && session.payment_intent) {
      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID' as const,
          paidAt: new Date(),
          stripePaymentIntentId: session.payment_intent as string,
        },
      });
      try {
        await sendReceiptEmail(updated.clientEmail, updated);
      } catch {
        // receipt email failure should not break webhook ack
      }
    }
  }

  return res.json({ received: true });
};

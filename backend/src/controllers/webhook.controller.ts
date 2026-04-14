import type { Request, Response } from 'express';
import pino from 'pino';
import { markPaymentRecovered } from '../services/payment.service.js';
import { getSourceWithSecrets } from '../services/source.service.js';
import { logAuditAction } from '../services/audit.service.js';
import { prisma } from '../utils/prisma.js';
import { enqueueRecoveryJob } from '../jobs/recovery.queue.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

/**
 * Handle incoming webhooks for any configured provider.
 */
export const handleUnifiedWebhook = async (req: Request, res: Response) => {
  const { provider, sourceId } = req.params;
  
  const source = await getSourceWithSecrets(String(sourceId || ''));
  if (!source) {
    logger.warn({ sourceId, provider }, 'Webhook rejected: Unknown source');
    return res.status(404).json({ error: 'Unknown source' });
  }

  if (source.provider !== String(provider || '').toLowerCase()) {
    logger.warn({ sourceId, expected: source.provider, received: provider }, 'Webhook rejected: Provider mismatch');
    return res.status(400).json({ error: 'Provider mismatch' });
  }

  const rawBody = (req.body as Buffer).toString('utf8');
  const adapter = ProviderFactory.getProvider(source.provider);

  // 1. Verify Signature
  // Different providers use different header keys (x-razorpay-signature, stripe-signature, etc.)
  const sigHeader = provider === 'razorpay' ? 'x-razorpay-signature' : 'stripe-signature';
  const sig = req.headers[sigHeader];

  if (provider === 'stripe') {
    // Stripe has more complex verification (using its SDK), handled inside the adapter if possible
    // or we can pass the req/headers. For now, we'll keep it simple in the adapter.
  }

  const isValid = await adapter.verifyWebhookSignature(rawBody, String(sig || ''), source.webhookSecret);
  if (!isValid) {
    logger.warn({ sourceId, provider }, 'Webhook rejected: Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 2. Parse & Process
  const payload = JSON.parse(rawBody);
  const eventData = adapter.parseWebhook(payload);

  if (!eventData) {
    // Usually means it's an event type we don't care about (e.g. payout.created)
    return res.json({ received: true, ignored: true });
  }

  try {
    if (eventData.eventType === 'payment.failed') {
      await handleFail(source.id, source.userId, eventData);
    } else if (eventData.eventType === 'payment.captured') {
      await handleCapture(source.userId, eventData);
    }
  } catch (err) {
    logger.error({ err, providerEventId: eventData.providerEventId }, 'Error processing webhook event');
  }

  res.json({ received: true });
};

const handleFail = async (srcId: string, uId: string, data: any) => {
  const providerEventId = data.providerEventId;
  
  if (await prisma.paymentEvent.findUnique({ where: { providerEventId } })) return;

  await prisma.$transaction(async (tx) => {
    const pEvent = await tx.paymentEvent.create({
      data: { 
        sourceId: srcId, 
        providerEventId, 
        eventType: 'payment.failed', 
        paymentId: data.paymentId, 
        amount: data.amount, 
        email: data.customerEmail, 
        contact: data.customerPhone, 
        status: 'failed', 
        rawData: data.rawData 
      },
    });

    if (!(await tx.failedPayment.findUnique({ where: { paymentId: data.paymentId } }))) {
      const fp = await tx.failedPayment.create({
        data: { 
          userId: uId, 
          paymentId: data.paymentId, 
          orderId: data.orderId, 
          amount: data.amount, 
          currency: data.currency || 'INR', 
          customerEmail: data.customerEmail, 
          customerPhone: data.customerPhone, 
          customerName: data.customerName, 
          metadata: data.rawData, 
          eventId: pEvent.id, 
          nextRetryAt: new Date() 
        },
      });
      void enqueueRecoveryJob(fp.id).catch((err) =>
        logger.error({ failedPaymentId: fp.id, err }, 'Job enqueue failed')
      );
    }
  });

  await logAuditAction(uId, 'PAYMENT_FAILED_RECEIVED', 'FailedPayment', data.paymentId, { amount: data.amount });
};

const handleCapture = async (uId: string, data: any) => {
  const f = await prisma.failedPayment.findFirst({ 
    where: { 
      userId: uId, 
      status: { in: ['pending', 'retrying'] }, 
      OR: [
        { paymentId: data.paymentId }, 
        ...(data.orderId ? [{ orderId: data.orderId }] : [])
      ] 
    } 
  });
  
  if (!f) return;

  await markPaymentRecovered(f.id, uId);
  await logAuditAction(uId, 'PAYMENT_RECOVERED', 'FailedPayment', f.id, { recoveredId: data.paymentId });
};

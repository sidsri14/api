import type { Job } from 'bullmq';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';
import { NotificationService } from '../services/NotificationService.js';
import { recoveryQueue } from './recovery.queue.js';
import { RETRY_DELAYS_MS } from '../services/payment.service.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { getSourceWithSecrets } from '../services/source.service.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

export interface RecoveryJobData {
  failedPaymentId: string;
}

/**
 * BullMQ Processor for payment recovery jobs.
 * Day 1-2 of MVP Roadmap Implementation.
 */
export async function processRecoveryJob(job: Job<RecoveryJobData>): Promise<void> {
  const { failedPaymentId } = job.data;

  // 1. Eligibility & Race Condition Guard
  const payment = await prisma.failedPayment.findUnique({
    where: { id: failedPaymentId },
    include: { user: true, event: { select: { sourceId: true } } },
  });

  if (!payment || payment.status === 'recovered' || payment.status === 'abandoned') {
    logger.info({ failedPaymentId }, 'Payment no longer eligible — skipping');
    return;
  }

  // 2. Plan-based Guard (only starter/pro processed)
  if (payment.user.plan === 'free') {
    logger.info({ failedPaymentId, userId: payment.userId }, 'Skipping recovery for Free plan user');
    return;
  }

  // 3. Advisory Lock
  await prisma.failedPayment.update({
    where: { id: failedPaymentId },
    data: { lockedAt: new Date(), status: 'retrying' }
  });

  try {
    // 3. Create/Fetch Recovery Link — check DB first to avoid duplicate Razorpay API calls on retry.
    const existingLink = await prisma.recoveryLink.findFirst({
      where: { failedPaymentId },
      orderBy: { createdAt: 'desc' },
    });

    let link: string;
    if (existingLink) {
      link = existingLink.url; // reuse existing link so email sends the correct URL
      logger.info({ failedPaymentId }, 'Reusing existing recovery link on job retry');
    } else {
      let generatedLink: string | null = null;
      const sourceId = payment.event?.sourceId;
      if (sourceId) {
        const source = await getSourceWithSecrets(sourceId);
        if (source) {
          const adapter = ProviderFactory.getProvider(source.provider);
          generatedLink = await adapter.generateRecoveryLink(payment, source);
        }
      }

      // Fallback removed — we now rely strictly on source adapters. 
      // (Old fallback used RazorpayService.createPaymentLink(payment) with global env keys)

      if (!generatedLink) {
        logger.warn({ failedPaymentId }, 'Failed to generate recovery link — will retry');
        throw new Error('Recovery link generation failed');
      }

      await prisma.recoveryLink.create({
        data: {
          failedPaymentId,
          url: generatedLink,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      link = generatedLink;
    }

    // ── Click Tracking ────────────────────────────────────────────────────────
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const trackingUrl = `${backendUrl}/api/recovery/track/${failedPaymentId}`;

    // 4. Send Recovery Notification (Email / SMS / WhatsApp)
    await NotificationService.dispatchRecovery(payment, trackingUrl);

    // 5. Schedule Next Retry or Abandon
    if (payment.retryCount < 2) {
      const nextDelay = RETRY_DELAYS_MS[payment.retryCount] as number;
      if (nextDelay === undefined) throw new Error('Invalid retry delay configuration');

      await recoveryQueue.add(
        'process-payment',
        { failedPaymentId },
        { delay: nextDelay }
      );
      
      // Update state for next cycle
      await prisma.failedPayment.update({
        where: { id: failedPaymentId },
        data: {
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
          nextRetryAt: new Date(Date.now() + nextDelay),
          lockedAt: null
        }
      });
      logger.info({ failedPaymentId, retryCount: payment.retryCount + 1 }, 'Scheduled next reminder');
    } else {
      // Final attempt reached
      await prisma.failedPayment.update({
        where: { id: failedPaymentId },
        data: { status: 'abandoned', lockedAt: null }
      });
      logger.info({ failedPaymentId }, 'Max retries reached — abandoned');
    }

  } catch (err) {
    logger.error({ failedPaymentId, err }, 'Failed to process recovery job');
    // Release lock on error so BullMQ retry (or next pass) can pick it up
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: { lockedAt: null }
    });
    throw err; // ensure BullMQ knows the job failed
  }
}

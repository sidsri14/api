import 'dotenv/config';
import pino from 'pino';
import { prisma } from './utils/prisma.js';
import { PaymentService } from './services/payment.service.js';
import { RazorpayService } from './services/razorpay.service.js';
import { SourceService } from './services/source.service.js';
import { sendPaymentFailedEmail, sendPaymentReminderEmail } from './services/email.service.js';
import { AuditService } from './services/audit.service.js';

const RECOVERY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const ABANDON_AFTER_DAYS = 7;

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
});

let isShuttingDown = false;
let recoveryHandle: ReturnType<typeof setTimeout> | null = null;

const processRecoveryQueue = async (): Promise<void> => {
  if (isShuttingDown) return;

  logger.info('Recovery worker tick started');

  try {
    // 1. Mark payments older than ABANDON_AFTER_DAYS with no more retries as abandoned
    const abandonThreshold = new Date(Date.now() - ABANDON_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const toAbandon = await prisma.failedPayment.findMany({
      where: {
        status: { in: ['pending', 'retrying'] },
        OR: [
          { createdAt: { lt: abandonThreshold } },
          { retryCount: { gte: 3 } },
        ],
      },
    });
    for (const p of toAbandon) {
      await PaymentService.markAbandoned(p.id);
      logger.info({ paymentId: p.paymentId }, 'Payment abandoned');
    }
    if (toAbandon.length > 0) {
      logger.info(`Marked ${toAbandon.length} payment(s) as abandoned`);
    }

    // 2. Process retry queue (pending + retrying with retryCount < 3)
    const pending = await PaymentService.getPendingForRetry();
    logger.info(`${pending.length} payment(s) ready for retry`);

    for (const payment of pending) {
      try {
        // Race condition guard: re-check status before processing.
        // The payment could have been recovered by a webhook between our query and now.
        const fresh = await prisma.failedPayment.findUnique({
          where: { id: payment.id },
          select: { status: true },
        });
        if (!fresh || !['pending', 'retrying'].includes(fresh.status)) {
          logger.info({ paymentId: payment.paymentId }, 'Payment already processed, skipping');
          continue;
        }

        // Get source credentials (decrypted) for this payment
        let keyId = process.env.RAZORPAY_KEY_ID!;
        let keySecret = process.env.RAZORPAY_KEY_SECRET!;

        if (payment.eventId) {
          const event = await prisma.paymentEvent.findUnique({
            where: { id: payment.eventId },
            select: { sourceId: true },
          });
          if (event?.sourceId) {
            const source = await SourceService.getSourceForWebhook(event.sourceId);
            if (source) {
              keyId = source.keyId;
              keySecret = source.keySecret; // already decrypted by getSourceForWebhook
            }
          }
        }

        // Use existing recovery link if available, otherwise create one
        let paymentLink = payment.recoveryLinks[0]?.url;
        if (!paymentLink) {
          paymentLink = await RazorpayService.createPaymentLink(keyId, keySecret, {
            amount: payment.amount,
            currency: payment.currency,
            customerName: payment.customerName ?? undefined,
            customerEmail: payment.customerEmail,
            customerPhone: payment.customerPhone ?? undefined,
            description: `Retry payment${payment.orderId ? ` for order ${payment.orderId}` : ''}`,
            referenceId: payment.id,
          });
          await PaymentService.createRecoveryLink(payment.id, paymentLink);
        }

        const dayOffset = payment.retryCount === 0 ? 0 : payment.retryCount === 1 ? 1 : 3;

        // Fire-and-forget: email must not block the worker loop or delay DB updates
        const emailParams = payment.retryCount === 0
          ? sendPaymentFailedEmail(payment.customerEmail, {
              customerName: payment.customerName ?? undefined,
              amount: payment.amount,
              currency: payment.currency,
              paymentLink,
              paymentId: payment.paymentId,
            })
          : sendPaymentReminderEmail(payment.customerEmail, {
              customerName: payment.customerName ?? undefined,
              amount: payment.amount,
              currency: payment.currency,
              paymentLink,
              dayOffset,
              paymentId: payment.paymentId,
            });
        void emailParams.catch((err: unknown) =>
          logger.error({ paymentId: payment.paymentId, err }, 'Email send failed')
        );

        await PaymentService.recordReminderAndIncrementRetry(payment.id, dayOffset, 'email');
        await AuditService.log(
          payment.userId,
          'PAYMENT_REMINDER_SENT',
          'FailedPayment',
          payment.id,
          { retryCount: payment.retryCount, dayOffset, email: payment.customerEmail }
        );

        logger.info({ paymentId: payment.paymentId, retryCount: payment.retryCount }, 'Reminder sent');
      } catch (err) {
        logger.error({ paymentId: payment.paymentId, err }, 'Failed to process payment retry');
      }
    }
  } catch (error) {
    logger.error(error, 'Recovery queue processing error');
  } finally {
    if (!isShuttingDown) {
      recoveryHandle = setTimeout(processRecoveryQueue, RECOVERY_INTERVAL_MS);
    }
  }
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Shutting down worker (${signal})`);
  isShuttingDown = true;
  if (recoveryHandle) clearTimeout(recoveryHandle);
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

logger.info('RecoverPay Worker v2.0 — started');
processRecoveryQueue();

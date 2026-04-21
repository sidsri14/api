import { Worker, Job } from 'bullmq';
import { redisConnection } from './recovery.queue.js';
import { prisma } from '../utils/prisma.js';
import { sendReminderEmail } from '../lib/resend.js';
import pino from 'pino';

const logger = pino({ name: 'invoice-processor', transport: { target: 'pino-pretty' } });

export const invoiceWorker = new Worker(
  'invoice-reminders',
  async (job: Job) => {
    const { invoiceId, type } = job.data as { invoiceId: string; type: string };
    logger.info({ invoiceId, type }, 'Processing invoice reminder');

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) {
      logger.warn({ invoiceId }, 'Invoice not found, skipping');
      return;
    }

    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      logger.info({ invoiceId, status: invoice.status }, 'Invoice already resolved, skipping reminder');
      return;
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: invoice.userId } });
      let brandData: Record<string, string> = {};
      try { brandData = user?.brandSettings ? JSON.parse(user.brandSettings) : {}; } catch { /* malformed JSON — use defaults */ }

      await sendReminderEmail(invoice.clientEmail, invoice, {
        accentColor: brandData.accentColor,
        companyName: brandData.companyName,
        emailTone: user?.brandEmailTone || 'professional'
      });
      logger.info({ invoiceId, type }, 'Reminder email sent successfully');

      if (type === 'reminder2') {
        // Atomic guard: only flip to OVERDUE if the invoice is still unpaid.
        // A concurrent payment between the fetch above and this write would
        // otherwise revert a PAID invoice back to OVERDUE.
        await prisma.invoice.updateMany({
          where: { id: invoiceId, status: { notIn: ['PAID', 'CANCELLED'] } },
          data: { status: 'OVERDUE' as const },
        });
      }
    } catch (err: any) {
      logger.error({ err: err.message, invoiceId }, 'Failed to send reminder email');
      throw err;
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

invoiceWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Invoice reminder job failed');
});

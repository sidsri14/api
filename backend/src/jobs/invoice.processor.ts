import { Worker, Job } from 'bullmq';
import { redisConnection } from './recovery.queue.js';
import { prisma } from '../utils/prisma.js';
import { sendReminderEmail } from '../lib/resend.js';
import pino from 'pino';

const logger = pino({ name: 'invoice-processor', transport: { target: 'pino-pretty' } });

export const invoiceWorker = new Worker(
  'invoice-reminders',
  async (job: Job) => {
    const { invoiceId, type } = job.data;
    logger.info({ invoiceId, type }, 'Processing invoice reminder');

    // 1. Fetch current status
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      logger.warn({ invoiceId }, 'Invoice not found, skipping');
      return;
    }

    // 2. Check if already paid
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      logger.info({ invoiceId, status: invoice.status }, 'Invoice already resolved, skipping reminder');
      return;
    }

    // 3. Send reminder
    try {
      await sendReminderEmail(invoice.clientEmail, invoice);
      logger.info({ invoiceId, type }, 'Reminder email sent successfully');

      // If it was the final reminder, mark as overdue
      if (type === 'reminder2') {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: 'overdue' }
        });
      }
    } catch (err: any) {
      logger.error({ err: err.message, invoiceId }, 'Failed to send reminder email');
      throw err; // retry
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

invoiceWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Invoice reminder job failed');
});

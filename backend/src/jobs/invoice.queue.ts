import { Queue } from 'bullmq';
import { redisConnection } from './recovery.queue.js'; // Reuse the same connection

export const invoiceQueue = new Queue('invoice-reminders', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/**
 * Enqueue an invoice reminder job.
 */
export async function enqueueInvoiceReminder(invoiceId: string, type: 'reminder1' | 'reminder2', delayMs: number): Promise<void> {
  await invoiceQueue.add(
    type,
    { invoiceId, type },
    { delay: delayMs, jobId: `${type}-${invoiceId}` } // deduplicate
  );
}

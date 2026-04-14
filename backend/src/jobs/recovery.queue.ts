import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Shared Redis connection for the queue (producer side).
// maxRetriesPerRequest: null is required by BullMQ.
export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const recoveryQueue = new Queue('payment-recovery', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,              // retry the job itself up to 3 times on unexpected throws
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: 200,    // keep last 200 completed jobs for inspection
    removeOnFail: 500,        // keep last 500 failed jobs for dead-letter review
  },
});

/**
 * Enqueue a recovery job for a failed payment.
 *
 * @param failedPaymentId  The FailedPayment.id to process.
 * @param delayMs          Optional delay before the job becomes active (default: 0 = immediate).
 */
export async function enqueueRecoveryJob(failedPaymentId: string, delayMs = 0): Promise<void> {
  await recoveryQueue.add(
    'process-payment',
    { failedPaymentId },
    { delay: delayMs }
  );
}

/**
 * Register the daily PII-prune repeatable job.
 *
 * Safe to call on every worker startup — BullMQ deduplicates repeatable jobs by
 * their (name + cron pattern + jobId) fingerprint, so no duplicate schedulers
 * accumulate across restarts.
 *
 * Override the schedule via DATA_PRUNE_CRON env var (default: 02:00 UTC daily).
 */
export async function enqueuePrunePiiJob(): Promise<void> {
  const pattern = process.env.DATA_PRUNE_CRON || '0 2 * * *';
  await recoveryQueue.add(
    'pii-prune',
    {},
    {
      repeat: { pattern },
      jobId: 'pii-prune-daily',
      removeOnComplete: 30,
      removeOnFail: 50,
    }
  );
}

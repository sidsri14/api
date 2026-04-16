import 'dotenv/config';
import pino from 'pino';
import IORedis from 'ioredis';

// Warn about delivery-channel env vars at worker startup (worker is where emails/SMS fire).
const DELIVERY_ENV: Array<{ key: string; impact: string }> = [
  { key: 'SMTP_HOST',             impact: 'Recovery emails will print to console only' },
  { key: 'TWILIO_SID',            impact: 'Pro-plan SMS/WhatsApp (3rd attempt) will be skipped' },
  { key: 'TWILIO_AUTH_TOKEN',     impact: 'Pro-plan SMS/WhatsApp (3rd attempt) will be skipped' },
  { key: 'TWILIO_FROM_NUMBER',    impact: 'Pro-plan SMS (3rd attempt) will be skipped' },
  { key: 'TWILIO_WHATSAPP_FROM',  impact: 'Pro-plan WhatsApp (3rd attempt) will be skipped (optional)' },
];
DELIVERY_ENV.filter(({ key }) => !process.env[key]).forEach(({ key, impact }) =>
  console.warn(`[Worker] ⚠  ${key} not set: ${impact}`)
);
import { Worker } from 'bullmq';
import { prisma } from './utils/prisma.js';
import { processRecoveryJob } from './jobs/recovery.processor.js';
import { processPruneJob } from './jobs/prune.processor.js';
import { processWebhookDeliveryJob } from './jobs/webhook.processor.js';
import { enqueuePrunePiiJob } from './jobs/recovery.queue.js';

const ABANDON_AFTER_DAYS = 7;
const ABANDON_INTERVAL_MS = 60 * 60 * 1000; // check every hour

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

// Separate Redis connection for the Worker (BullMQ requires its own connection).
const workerConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Check Redis eviction policy — BullMQ requires "noeviction" or jobs may be silently dropped.
// Upstash may reject CONFIG GET; treat that as a debug-level non-issue.
async function checkRedisEvictionPolicy(): Promise<void> {
  try {
    const result = await workerConnection.config('GET', 'maxmemory-policy') as string[];
    const policy = result[1];
    if (policy && policy !== 'noeviction') {
      logger.warn(
        `[Worker] Redis maxmemory-policy is "${policy}" — expected "noeviction". Jobs may be silently dropped! Fix in Upstash dashboard: Configuration → Eviction Policy → noeviction`
      );
    }
  } catch {
    logger.debug('[Worker] Could not read Redis maxmemory-policy (expected if using Upstash — CONFIG GET is restricted)');
  }
}
void checkRedisEvictionPolicy();

// ── BullMQ Worker ─────────────────────────────────────────────────────────────

const recoveryWorker = new Worker(
  'payment-recovery',
  async (job) => {
    if (job.name === 'pii-prune') {
      return processPruneJob(job);
    }
    if (job.name === 'webhook-delivery') {
      return processWebhookDeliveryJob(job);
    }
    return processRecoveryJob(job);
  },
  {
    connection: workerConnection,
    concurrency: 5, // process up to 5 payments in parallel
  }
);

recoveryWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, paymentId: job.data.failedPaymentId }, 'Recovery job completed');
});

recoveryWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, paymentId: job?.data?.failedPaymentId, err }, 'Recovery job failed');
});

// ── Hourly abandon cleanup ────────────────────────────────────────────────────
// Runs on a simple interval — abandonment doesn't need BullMQ's reliability guarantees.

let abandonHandle: ReturnType<typeof setTimeout> | null = null;

const runAbandonCleanup = async (): Promise<void> => {
  try {
    const abandonThreshold = new Date(Date.now() - ABANDON_AFTER_DAYS * 86_400_000);
    const lockExpiry = new Date(Date.now() - 30 * 60_000);

    const toAbandon = await prisma.failedPayment.findMany({
      where: {
        status: { in: ['pending', 'retrying'] },
        AND: [
          { OR: [{ lockedAt: null }, { lockedAt: { lt: lockExpiry } }] },
          { OR: [{ retryCount: { gte: 3 } }, { createdAt: { lt: abandonThreshold } }] },
        ],
      },
      select: { id: true, userId: true, paymentId: true },
    });

    if (toAbandon.length) {
      const ids = toAbandon.map(p => p.id);
      await prisma.failedPayment.updateMany({ where: { id: { in: ids } }, data: { status: 'abandoned' } });
      await prisma.auditLog.createMany({
        data: toAbandon.map(p => ({
          userId: p.userId,
          action: 'PAYMENT_ABANDONED',
          resource: 'FailedPayment',
          resourceId: p.id,
        })),
      });
      logger.info(`Abandoned ${toAbandon.length} payment(s)`);
    }
  } catch (err) {
    logger.error(err, 'Abandon cleanup error');
  } finally {
    abandonHandle = setTimeout(runAbandonCleanup, ABANDON_INTERVAL_MS);
  }
};

// ── Shutdown ──────────────────────────────────────────────────────────────────

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Shutting down worker (${signal})`);
  if (abandonHandle) clearTimeout(abandonHandle);
  if (heartbeatHandle) clearInterval(heartbeatHandle);
  await recoveryWorker.close();
  workerConnection.disconnect();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Worker Heartbeat ──────────────────────────────────────────────────────────
// Writes a timestamp to Redis every 60 s with a 150 s TTL.
// The health endpoint reads this key — if absent/stale, the worker is down.

const HEARTBEAT_KEY = 'payrecover:worker:heartbeat';
const HEARTBEAT_INTERVAL_MS = 60_000;

const writeHeartbeat = () =>
  workerConnection
    .set(HEARTBEAT_KEY, Date.now().toString(), 'EX', 150)
    .catch(err => logger.error(err, '[Heartbeat] Failed to write'));

let heartbeatHandle: ReturnType<typeof setInterval> | null = null;

// ── Start ─────────────────────────────────────────────────────────────────────

logger.info('PayRecover Worker — started (BullMQ + Redis)');
runAbandonCleanup();
writeHeartbeat();
heartbeatHandle = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);

// Register daily PII-prune repeatable job (idempotent — BullMQ deduplicates by jobId).
enqueuePrunePiiJob().catch(err =>
  logger.error(err, '[PII Prune] Failed to register repeatable job')
);

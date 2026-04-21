import 'dotenv/config';
import * as Sentry from "@sentry/bun";
import pino from 'pino';
import IORedis from 'ioredis';
import { Worker } from 'bullmq';
import { prisma } from './utils/prisma.js';
import { processWebhookDeliveryJob } from './jobs/webhook.processor.js';
import { enqueuePrunePiiJob } from './jobs/recovery.queue.js';
import { invoiceWorker } from './jobs/invoice.processor.js';

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 1.0 });

const DELIVERY_ENV: Array<{ key: string; impact: string }> = [
  { key: 'RESEND_API_KEY', impact: 'Emails will print to console only' },
  { key: 'SENTRY_DSN',     impact: 'Error monitoring will be disabled' },
];
DELIVERY_ENV.filter(({ key }) => !process.env[key]).forEach(({ key, impact }) =>
  console.warn(`[Worker] ⚠  ${key} not set: ${impact}`)
);

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

const workerConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

async function checkRedisEvictionPolicy(): Promise<void> {
  try {
    const result = await workerConnection.config('GET', 'maxmemory-policy') as string[];
    const policy = result[1];
    if (policy && policy !== 'noeviction') {
      logger.warn(`[Worker] Redis maxmemory-policy is "${policy}" — expected "noeviction". Jobs may drop silently!`);
    }
  } catch {
    logger.debug('[Worker] Could not read Redis maxmemory-policy (expected on Upstash)');
  }
}
void checkRedisEvictionPolicy();

// ── Webhook delivery worker ───────────────────────────────────────────────────

async function runPiiPrune(): Promise<void> {
  const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '90', 10);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  logger.info({ cutoff, retentionDays }, '[PII Prune] Starting');

  // 1. Delete old audit logs (they contain IP addresses, user agents, details)
  const deletedLogs = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  // 2. Anonymise old paid/cancelled invoice client emails — replace with
  //    a sentinel so the record stays for accounting but PII is removed.
  const anonInvoices = await prisma.invoice.updateMany({
    where: {
      status: { in: ['PAID', 'CANCELLED'] },
      updatedAt: { lt: cutoff },
      clientEmail: { not: '[removed]' },
    },
    data: { clientEmail: '[removed]' },
  });

  // 3. Remove phone numbers from clients not updated recently
  const anonClients = await prisma.client.updateMany({
    where: {
      updatedAt: { lt: cutoff },
      phone: { not: null },
    },
    data: { phone: null },
  });

  // 4. Delete old webhook delivery records — response bodies can contain PII
  const deletedDeliveries = await prisma.webhookDelivery.deleteMany({
    where: { attemptedAt: { lt: cutoff } },
  });

  logger.info(
    {
      deletedLogs: deletedLogs.count,
      anonInvoices: anonInvoices.count,
      anonClients: anonClients.count,
      deletedDeliveries: deletedDeliveries.count,
    },
    '[PII Prune] Complete'
  );
}

const webhookWorker = new Worker(
  'payment-recovery',
  async (job) => {
    if (job.name === 'webhook-delivery') return processWebhookDeliveryJob(job);
    if (job.name === 'pii-prune') return runPiiPrune();
    // Unknown job names must fail explicitly so they appear in the BullMQ dead-letter
    // queue rather than silently succeeding and hiding the misconfiguration.
    throw new Error(`Unknown job name: ${job.name}`);
  },
  { connection: workerConnection, concurrency: 5 }
);

webhookWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Webhook job failed');
  Sentry.captureException(err);
});

// ── Heartbeat ─────────────────────────────────────────────────────────────────

const HEARTBEAT_KEY = 'stripeflow:worker:heartbeat';
const HEARTBEAT_INTERVAL_MS = 60_000;

const writeHeartbeat = () =>
  workerConnection
    .set(HEARTBEAT_KEY, Date.now().toString(), 'EX', 150)
    .catch(err => logger.error(err, '[Heartbeat] Failed to write'));

let heartbeatHandle: ReturnType<typeof setInterval> | null = null;

// ── Shutdown ──────────────────────────────────────────────────────────────────

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Shutting down worker (${signal})`);
  if (heartbeatHandle) clearInterval(heartbeatHandle);
  await webhookWorker.close();
  await invoiceWorker.close();
  workerConnection.disconnect();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Start ─────────────────────────────────────────────────────────────────────

logger.info('StripeFlow Worker — started (BullMQ + Redis)');
writeHeartbeat();
heartbeatHandle = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);

enqueuePrunePiiJob().catch(err =>
  logger.error(err, '[PII Prune] Failed to register repeatable job')
);

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

const webhookWorker = new Worker(
  'payment-recovery',
  async (job) => {
    if (job.name === 'webhook-delivery') return processWebhookDeliveryJob(job);
    if (job.name === 'pii-prune') {
      logger.info('PII prune job skipped — no payment data to prune');
      return;
    }
  },
  { connection: workerConnection, concurrency: 5 }
);

webhookWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Webhook job failed');
  Sentry.captureException(err);
});

// ── Heartbeat ─────────────────────────────────────────────────────────────────

const HEARTBEAT_KEY = 'stripepay:worker:heartbeat';
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

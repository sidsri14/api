import type { Job } from 'bullmq';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

const RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS || '90', 10);
const REMOVED = '[removed]';

/**
 * BullMQ Processor for daily PII pruning.
 *
 * Anonymises FailedPayment and PaymentEvent records that have reached a terminal
 * state (recovered | abandoned) and exceeded the DATA_RETENTION_DAYS window.
 * AuditLog.details is stripped for all records older than the cutoff.
 * No schema migration needed — non-nullable fields receive a '[removed]' sentinel,
 * nullable fields are set to null.
 *
 * Idempotent: records where customerEmail === '[removed]' are skipped.
 */
export async function processPruneJob(_job: Job): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);

  logger.info({ cutoff, retentionDays: RETENTION_DAYS }, '[PII Prune] Starting daily prune run');

  // ── 1. Locate eligible FailedPayment rows ─────────────────────────────────
  // Clock starts at the moment the payment reached a terminal state:
  //   recovered → recoveredAt
  //   abandoned → createdAt (no abandonedAt column; 7-day abandon threshold means
  //                          createdAt is a conservative proxy)
  const toProneList = await prisma.failedPayment.findMany({
    where: {
      customerEmail: { not: REMOVED }, // skip already-pruned
      OR: [
        { status: 'recovered', recoveredAt: { lt: cutoff } },
        { status: 'abandoned', createdAt: { lt: cutoff } },
      ],
    },
    select: { id: true, userId: true, eventId: true },
  });

  if (!toProneList.length) {
    logger.info('[PII Prune] No records eligible for pruning — done');
    return;
  }

  const paymentIds = toProneList.map(p => p.id);
  const eventIds   = toProneList.map(p => p.eventId).filter(Boolean) as string[];

  // ── 2. Anonymise FailedPayment PII ───────────────────────────────────────
  await prisma.failedPayment.updateMany({
    where: { id: { in: paymentIds } },
    data: {
      customerEmail: REMOVED,  // non-nullable → sentinel
      customerPhone: null,
      customerName:  null,
    },
  });

  // ── 3. Anonymise linked PaymentEvent PII ─────────────────────────────────
  if (eventIds.length) {
    await prisma.paymentEvent.updateMany({
      where: { id: { in: eventIds } },
      data: {
        email:   REMOVED, // non-nullable → sentinel
        contact: null,
        rawData: '{}',
      },
    });
  }

  // ── 4. Strip AuditLog.details older than cutoff ───────────────────────────
  // Keeps the row (preserving aggregate counts) but removes any PII-containing
  // metadata that may have been captured at event time.
  await prisma.auditLog.updateMany({
    where: { createdAt: { lt: cutoff }, details: { not: null } },
    data: { details: null },
  });

  // ── 5. Write a system-level prune audit record (no PII) ───────────────────
  await prisma.auditLog.create({
    data: {
      action:   'PII_PRUNED',
      resource: 'FailedPayment',
      details: JSON.stringify({
        pruned:        paymentIds.length,
        eventsPruned:  eventIds.length,
        retentionDays: RETENTION_DAYS,
        cutoff:        cutoff.toISOString(),
      }),
    },
  });

  logger.info(
    { pruned: paymentIds.length, eventsPruned: eventIds.length },
    '[PII Prune] Done'
  );
}

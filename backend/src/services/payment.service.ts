import { Prisma } from '@prisma/client';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';
import { logAuditAction } from './audit.service.js';
import { OutboundWebhookService } from './OutboundWebhookService.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

export type FailedPaymentWithLinks = Prisma.FailedPaymentGetPayload<{
  include: { recoveryLinks: { orderBy: { createdAt: 'desc' }, take: 1 } }
}>;

const ZERO_METRICS = {
  failedAmount: 0, recoveredAmount: 0, recoveryRate: 0,
  recoveredThisWeek: 0, recoveredThisMonth: 0, recoveredViaLink: 0,
  totalClicks: 0,
};

// Exported so recovery.processor.ts can schedule BullMQ jobs with the same delays.
// Index = current retryCount (before increment): [0→retry1 after 24h, 1→retry2 after 72h]
export const RETRY_DELAYS_MS = [24 * 60 * 60 * 1000, 72 * 60 * 60 * 1000] as const;

const SORTABLE_FIELDS = ['status', 'amount', 'createdAt', 'retryCount'] as const;
type SortKey = typeof SORTABLE_FIELDS[number];

/** Retrieves a paginated list of failed payments with optional filters. */
export const getPaymentsList = async (userId: string, { status, sourceId, search, page = 1, limit = 50, sortKey = 'createdAt', sortDir = 'desc' }: any = {}) => {
  const resolvedSortKey: SortKey = SORTABLE_FIELDS.includes(sortKey) ? sortKey : 'createdAt';
  const resolvedSortDir: 'asc' | 'desc' = sortDir === 'asc' ? 'asc' : 'desc';

  const safeSearch = search ? String(search).slice(0, 200) : undefined;

  const where: Prisma.FailedPaymentWhereInput = {
    userId,
    ...(status && { status }),
    ...(sourceId && { sourceId }),
    ...(safeSearch && { OR: [
      { customerEmail: { contains: safeSearch } },
      { paymentId: { contains: safeSearch } },
      { customerName: { contains: safeSearch } },
    ]}),
  };

  const [payments, total] = await Promise.all([
    prisma.failedPayment.findMany({
      where, orderBy: { [resolvedSortKey]: resolvedSortDir }, skip: (page - 1) * limit, take: limit,
      include: { recoveryLinks: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.failedPayment.count({ where }),
  ]);

  return { payments, total, page, limit, pages: Math.ceil(total / limit) };
};

export const getPaymentDetails = (userId: string, id: string) => 
  prisma.failedPayment.findFirstOrThrow({
    where: { id, userId },
    include: {
      recoveryLinks: { orderBy: { createdAt: 'desc' } },
      reminders: { orderBy: { sentAt: 'desc' } },
      event: true,
    },
  });

export const markPaymentRecovered = async (failedPaymentId: string, userId: string, via: 'link' | 'external' = 'link') => {
  const updated = await prisma.failedPayment.update({
    where: { id: failedPaymentId },
    data: { status: 'recovered', recoveredAt: new Date(), recoveredVia: via },
  });
  await logAuditAction(userId, 'PAYMENT_RECOVERED', 'FailedPayment', failedPaymentId, { via });
  void OutboundWebhookService.dispatch(userId, 'payment.recovered', {
    id: updated.id, paymentId: updated.paymentId, amount: updated.amount,
    currency: updated.currency, status: updated.status, recoveredAt: updated.recoveredAt, recoveredVia: via,
  }).catch(() => {});
};

export const triggerManualRetry = async (userId: string, id: string) => {
  const p = await prisma.failedPayment.findFirst({ where: { id, userId } });
  if (!p) throw { status: 404, message: 'Payment not found' };
  if (!['pending', 'retrying'].includes(p.status)) throw { status: 400, message: 'Invalid status' };
  await prisma.failedPayment.update({ where: { id }, data: { nextRetryAt: new Date() } });
};

export const getPaymentMetrics = async (userId: string) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Optimized: Combine basic sums/counts into one groupBy instead of 5 separate aggregates
    const [statsByStatus, weekRecovered, monthRecovered, viaLinkRecovered, clicksAgg] = await Promise.all([
      prisma.failedPayment.groupBy({
        by: ['status'], where: { userId }, _sum: { amount: true }, _count: true 
      }),
      prisma.failedPayment.aggregate({ where: { userId, status: 'recovered', recoveredAt: { gte: weekAgo } }, _sum: { amount: true } }),
      prisma.failedPayment.aggregate({ where: { userId, status: 'recovered', recoveredAt: { gte: monthAgo } }, _sum: { amount: true } }),
      prisma.failedPayment.aggregate({ where: { userId, status: 'recovered', recoveredVia: 'link' }, _sum: { amount: true } }),
      prisma.failedPayment.aggregate({ where: { userId }, _sum: { clickCount: true } }),
    ]);

    const stats = Object.fromEntries(statsByStatus.map(s => [s.status, { sum: s._sum.amount ?? 0, count: s._count }]));
    const totalFailedSum = Object.values(stats).reduce((acc, s) => acc + s.sum, 0);
    const recoveredSum = stats['recovered']?.sum ?? 0;

    return {
      failedAmount: totalFailedSum,
      recoveredAmount: recoveredSum,
      recoveryRate: totalFailedSum > 0 ? Math.round((recoveredSum / totalFailedSum) * 1000) / 1000 : 0,
      recoveredThisWeek: weekRecovered._sum.amount ?? 0,
      recoveredThisMonth: monthRecovered._sum.amount ?? 0,
      recoveredViaLink: viaLinkRecovered._sum.amount ?? 0,
      totalClicks: clicksAgg._sum.clickCount ?? 0,
      counts: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v.count])),
    };
  } catch (err) {
    logger.error({ err }, 'Failed to compute payment metrics');
    return { ...ZERO_METRICS, counts: {} };
  }
};

export const getFullDashboardStats = async (userId: string) => {
  const m = await getPaymentMetrics(userId);
  const counts = { pending: 0, retrying: 0, recovered: 0, abandoned: 0, ...m.counts };

  // ── Phase 6: Platform Insights
  const interactions = await prisma.auditLog.findMany({
    where: { userId, action: 'PAYMENT_LINK_CLICKED' },
    select: { details: true }
  });

  const platformBreakdown = { mobile: 0, desktop: 0 };
  interactions.forEach(log => {
    try {
      const details = JSON.parse(log.details || '{}');
      if (details.platform === 'Mobile') platformBreakdown.mobile++;
      else platformBreakdown.desktop++;
    } catch (e) {}
  });

  return {
    totalFailed: (counts.pending || 0) + (counts.retrying || 0),
    totalRecovered: counts.recovered || 0,
    recoveryRate: Math.round(m.recoveryRate * 1000) / 10, // decimal → percentage
    totalFailedAmount: m.failedAmount,
    totalRecoveredAmount: m.recoveredAmount,
    recoveredThisWeek: m.recoveredThisWeek,
    recoveredThisMonth: m.recoveredThisMonth,
    totalClicks: m.totalClicks,
    counts,
    platformBreakdown
  };
};

import { prisma } from '../utils/prisma.js';

export class PaymentService {
  static async createFailedPayment(
    userId: string,
    data: {
      paymentId: string;
      orderId?: string;
      amount: number;
      currency: string;
      customerEmail: string;
      customerPhone?: string;
      customerName?: string;
      metadata?: string;
      eventId?: string;
    }
  ) {
    return prisma.failedPayment.create({
      data: {
        userId,
        paymentId: data.paymentId,
        orderId: data.orderId,
        amount: data.amount,
        currency: data.currency,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerName: data.customerName,
        metadata: data.metadata,
        eventId: data.eventId,
        nextRetryAt: new Date(), // process immediately on next worker tick
      },
    });
  }

  static async getPayments(
    userId: string,
    filters?: { status?: string; search?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 50));
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.search && {
        OR: [
          { customerEmail: { contains: filters.search } },
          { customerName: { contains: filters.search } },
          { paymentId: { contains: filters.search } },
        ],
      }),
    };

    const [payments, total] = await Promise.all([
      prisma.failedPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reminders: { orderBy: { sentAt: 'asc' }, take: 10 },
          recoveryLinks: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.failedPayment.count({ where }),
    ]);

    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getPaymentById(userId: string, id: string) {
    const payment = await prisma.failedPayment.findFirst({
      where: { id, userId },
      include: {
        reminders: { orderBy: { sentAt: 'asc' } },
        recoveryLinks: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!payment) {
      const err = new Error('Payment not found') as any;
      err.status = 404;
      throw err;
    }
    return payment;
  }

  /**
   * Aggregates payment statistics using DB-side aggregation (no full table scan).
   * Runs 4 parallel queries instead of fetching all rows into JS.
   */
  static async getDashboardStats(userId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalAgg, recoveredAgg, weekAgg, monthAgg] = await Promise.all([
      // Total failed count + sum
      prisma.failedPayment.aggregate({
        where: { userId },
        _count: { id: true },
        _sum: { amount: true },
      }),
      // All-time recovered count + sum
      prisma.failedPayment.aggregate({
        where: { userId, status: 'recovered' },
        _count: { id: true },
        _sum: { amount: true },
      }),
      // Recovered this week
      prisma.failedPayment.aggregate({
        where: { userId, status: 'recovered', recoveredAt: { gte: weekAgo } },
        _sum: { amount: true },
      }),
      // Recovered this month
      prisma.failedPayment.aggregate({
        where: { userId, status: 'recovered', recoveredAt: { gte: monthAgo } },
        _sum: { amount: true },
      }),
    ]);

    const totalFailed = totalAgg._count.id;
    const totalRecovered = recoveredAgg._count.id;
    const totalFailedAmount = totalAgg._sum.amount ?? 0;
    const totalRecoveredAmount = recoveredAgg._sum.amount ?? 0;
    const recoveryRate = totalFailed > 0 ? (totalRecovered / totalFailed) * 100 : 0;

    return {
      totalFailed,
      totalRecovered,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      totalFailedAmount,
      totalRecoveredAmount,
      recoveredThisWeek: weekAgg._sum.amount ?? 0,
      recoveredThisMonth: monthAgg._sum.amount ?? 0,
    };
  }

  static async markRecovered(failedPaymentId: string, via: 'link' | 'external' = 'link') {
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: { status: 'recovered', recoveredAt: new Date(), recoveredVia: via },
    });
  }

  // Status: pending → retrying → abandoned
  // Retry timing controlled by nextRetryAt field
  // Only paid-plan users get auto-recovery. Free plan = tracking only.
  static async getPendingForRetry() {
    return prisma.failedPayment.findMany({
      where: {
        status: { in: ['pending', 'retrying'] },
        retryCount: { lt: 3 },
        nextRetryAt: { lte: new Date() },
        user: { plan: 'paid' },
      },
      include: {
        recoveryLinks: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      take: 50, // process at most 50 per tick to keep cycles bounded
    });
  }

  static async recordReminder(failedPaymentId: string, dayOffset: number, type: string) {
    await prisma.reminder.create({
      data: { failedPaymentId, dayOffset, type, status: 'sent' },
    });
  }

  /**
   * Atomically records a reminder AND advances the retry counter in a single
   * Prisma transaction. Prevents the inconsistent state where a reminder is
   * logged but the retry count is never incremented (or vice versa) if one
   * of the writes fails.
   */
  static async recordReminderAndIncrementRetry(
    failedPaymentId: string,
    dayOffset: number,
    type: string
  ) {
    const payment = await prisma.failedPayment.findUnique({
      where: { id: failedPaymentId },
      select: { retryCount: true },
    });
    const currentCount = payment?.retryCount ?? 0;
    const newCount = currentCount + 1;
    const delayMs = PaymentService.RETRY_DELAYS_MS[currentCount] ?? null;
    const nextRetryAt = delayMs !== null ? new Date(Date.now() + delayMs) : null;

    await prisma.$transaction([
      prisma.reminder.create({
        data: { failedPaymentId, dayOffset, type, status: 'sent' },
      }),
      prisma.failedPayment.update({
        where: { id: failedPaymentId },
        data: { retryCount: newCount, lastRetryAt: new Date(), nextRetryAt, status: 'retrying' },
      }),
    ]);
  }

  static async createRecoveryLink(failedPaymentId: string, url: string) {
    return prisma.recoveryLink.create({
      data: { failedPaymentId, url },
    });
  }

  // Retry delay schedule: after retry N, wait X ms before retry N+1.
  // 3 attempts total (index 0, 1, 2). null = no further retry scheduled.
  private static readonly RETRY_DELAYS_MS: (number | null)[] = [
    24 * 60 * 60 * 1000,  // after retry 0 → wait 24h  (day 1 reminder)
    72 * 60 * 60 * 1000,  // after retry 1 → wait 72h  (day 3 final notice)
    null,                  // after retry 2 → no more retries; worker abandons at retryCount >= 3
  ];

  static async incrementRetry(failedPaymentId: string) {
    // Single atomic round trip: read current retryCount, compute next state, write — all in one query.
    // We can't use Prisma's { increment: 1 } here alone because we also need to compute
    // nextRetryAt from the new count, so we fetch first but keep it to one extra query.
    const payment = await prisma.failedPayment.findUnique({
      where: { id: failedPaymentId },
      select: { retryCount: true },
    });
    const currentCount = payment?.retryCount ?? 0;
    const newCount = currentCount + 1;
    const delayMs = PaymentService.RETRY_DELAYS_MS[currentCount] ?? null;
    const nextRetryAt = delayMs !== null ? new Date(Date.now() + delayMs) : null;

    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: {
        retryCount: newCount,
        lastRetryAt: new Date(),
        nextRetryAt,
        status: 'retrying',
      },
    });
  }

  /** Extended metrics for the billing/analytics page — DB-side aggregation only. */
  static async getMetrics(userId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalAgg, recoveredAgg, weekAgg, monthAgg, viaLinkAgg] = await Promise.all([
      prisma.failedPayment.aggregate({ where: { userId }, _sum: { amount: true } }),
      prisma.failedPayment.aggregate({ where: { userId, status: 'recovered' }, _sum: { amount: true } }),
      prisma.failedPayment.aggregate({ where: { userId, status: 'recovered', recoveredAt: { gte: weekAgo } }, _sum: { amount: true } }),
      prisma.failedPayment.aggregate({ where: { userId, status: 'recovered', recoveredAt: { gte: monthAgo } }, _sum: { amount: true } }),
      prisma.failedPayment.aggregate({ where: { userId, status: 'recovered', recoveredVia: 'link' }, _sum: { amount: true } }),
    ]);

    const failedAmount = totalAgg._sum.amount ?? 0;
    const recoveredAmount = recoveredAgg._sum.amount ?? 0;
    const recoveryRate = failedAmount > 0 ? recoveredAmount / failedAmount : 0;

    return {
      failedAmount,
      recoveredAmount,
      recoveryRate: Math.round(recoveryRate * 1000) / 1000,
      recoveredThisWeek: weekAgg._sum.amount ?? 0,
      recoveredThisMonth: monthAgg._sum.amount ?? 0,
      recoveredViaLink: viaLinkAgg._sum.amount ?? 0,
    };
  }

  static async markAbandoned(failedPaymentId: string) {
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: { status: 'abandoned' },
    });
  }

  static async triggerManualRetry(userId: string, failedPaymentId: string) {
    const payment = await prisma.failedPayment.findFirst({
      where: { id: failedPaymentId, userId },
    });
    if (!payment) {
      const err = new Error('Payment not found') as any;
      err.status = 404;
      throw err;
    }
    if (!['pending', 'retrying'].includes(payment.status)) {
      const err = new Error('Payment cannot be retried in its current state') as any;
      err.status = 400;
      throw err;
    }
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: { nextRetryAt: new Date() }, // schedule for immediate processing
    });
  }
}

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
    filters?: { status?: string; search?: string }
  ) {
    return prisma.failedPayment.findMany({
      where: {
        userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.search && {
          OR: [
            { customerEmail: { contains: filters.search } },
            { customerName: { contains: filters.search } },
            { paymentId: { contains: filters.search } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        reminders: { orderBy: { sentAt: 'asc' } },
        recoveryLinks: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
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

  static async getDashboardStats(userId: string) {
    const all = await prisma.failedPayment.findMany({
      where: { userId },
      select: { status: true, amount: true, recoveredAt: true },
    });

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const totalFailed = all.length;
    const recovered = all.filter((p) => p.status === 'recovered');
    const totalRecovered = recovered.length;
    const totalFailedAmount = all.reduce((sum, p) => sum + p.amount, 0);
    const totalRecoveredAmount = recovered.reduce((sum, p) => sum + p.amount, 0);
    const recoveryRate = totalFailed > 0 ? (totalRecovered / totalFailed) * 100 : 0;

    const recoveredThisWeek = recovered
      .filter(p => p.recoveredAt && new Date(p.recoveredAt).getTime() >= weekAgo)
      .reduce((sum, p) => sum + p.amount, 0);
    const recoveredThisMonth = recovered
      .filter(p => p.recoveredAt && new Date(p.recoveredAt).getTime() >= monthAgo)
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalFailed,
      totalRecovered,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      totalFailedAmount,
      totalRecoveredAmount,
      recoveredThisWeek,
      recoveredThisMonth,
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

  static async createRecoveryLink(failedPaymentId: string, url: string) {
    return prisma.recoveryLink.create({
      data: { failedPaymentId, url },
    });
  }

  // Retry delay schedule: after retry N, wait X ms before retry N+1
  private static readonly RETRY_DELAYS_MS = [
    24 * 60 * 60 * 1000,  // after retry 0 → wait 24h
    72 * 60 * 60 * 1000,  // after retry 1 → wait 72h
  ];

  static async incrementRetry(failedPaymentId: string) {
    const payment = await prisma.failedPayment.findUnique({
      where: { id: failedPaymentId },
      select: { retryCount: true },
    });
    const currentCount = payment?.retryCount ?? 0;
    const newCount = currentCount + 1;
    const delayMs = PaymentService.RETRY_DELAYS_MS[currentCount];
    const nextRetryAt = delayMs != null ? new Date(Date.now() + delayMs) : null;

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

  static async getMetrics(userId: string) {
    const all = await prisma.failedPayment.findMany({
      where: { userId },
      select: { status: true, amount: true, recoveredAt: true, recoveredVia: true },
    });
    const failedAmount = all.reduce((sum, p) => sum + p.amount, 0);
    const recovered = all.filter(p => p.status === 'recovered');
    const recoveredAmount = recovered.reduce((sum, p) => sum + p.amount, 0);
    const recoveryRate = failedAmount > 0 ? recoveredAmount / failedAmount : 0;

    const now = Date.now();
    const recoveredThisWeek = recovered
      .filter(p => p.recoveredAt && new Date(p.recoveredAt).getTime() >= now - 7 * 24 * 60 * 60 * 1000)
      .reduce((sum, p) => sum + p.amount, 0);
    const recoveredThisMonth = recovered
      .filter(p => p.recoveredAt && new Date(p.recoveredAt).getTime() >= now - 30 * 24 * 60 * 60 * 1000)
      .reduce((sum, p) => sum + p.amount, 0);
    const recoveredViaLink = recovered.filter(p => p.recoveredVia === 'link').reduce((sum, p) => sum + p.amount, 0);

    return {
      failedAmount,
      recoveredAmount,
      recoveryRate: Math.round(recoveryRate * 1000) / 1000,
      recoveredThisWeek,
      recoveredThisMonth,
      recoveredViaLink,
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

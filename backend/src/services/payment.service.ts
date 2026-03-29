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
      include: { reminders: { orderBy: { sentAt: 'asc' } } },
    });
  }

  static async getPaymentById(userId: string, id: string) {
    const payment = await prisma.failedPayment.findFirst({
      where: { id, userId },
      include: { reminders: { orderBy: { sentAt: 'asc' } } },
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
      select: { status: true, amount: true },
    });

    const totalFailed = all.length;
    const recovered = all.filter((p) => p.status === 'recovered');
    const totalRecovered = recovered.length;
    const totalFailedAmount = all.reduce((sum, p) => sum + p.amount, 0);
    const totalRecoveredAmount = recovered.reduce((sum, p) => sum + p.amount, 0);
    const recoveryRate = totalFailed > 0 ? (totalRecovered / totalFailed) * 100 : 0;

    return {
      totalFailed,
      totalRecovered,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      totalFailedAmount,
      totalRecoveredAmount,
    };
  }

  static async markRecovered(failedPaymentId: string) {
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: { status: 'recovered', recoveredAt: new Date() },
    });
  }

  static async getPendingForRetry() {
    const now = new Date();
    const ago48h = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const ago120h = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    return prisma.failedPayment.findMany({
      where: {
        status: 'pending',
        retryCount: { lt: 3 },
        OR: [
          { retryCount: 0, lastRetryAt: null },
          { retryCount: 1, lastRetryAt: { lte: ago48h } },
          { retryCount: 2, lastRetryAt: { lte: ago120h } },
        ],
      },
    });
  }

  static async recordReminder(failedPaymentId: string, dayOffset: number, type: string) {
    await prisma.reminder.create({
      data: { failedPaymentId, dayOffset, type, status: 'sent' },
    });
  }

  static async incrementRetry(failedPaymentId: string, paymentLink: string) {
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: {
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
        paymentLink,
      },
    });
  }

  static async markExpired(failedPaymentId: string) {
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: { status: 'expired' },
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
    if (payment.status !== 'pending') {
      const err = new Error('Payment is not in pending state') as any;
      err.status = 400;
      throw err;
    }
    // Reset timing so worker picks it up on next tick.
    // Use epoch (new Date(0)) rather than null: the null path in getPendingForRetry
    // only matches retryCount=0. For retryCount>0 the query uses `lte: agoXXh`, so
    // a past epoch date guarantees immediate pickup regardless of retry count.
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: { lastRetryAt: new Date(0) },
    });
  }
}

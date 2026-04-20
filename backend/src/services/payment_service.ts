import { Prisma } from '@prisma/client';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';
import { logAuditAction } from './audit.service.js';
import { OutboundWebhookService } from './OutboundWebhookService.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

export const getInvoiceMetrics = async (userId: string) => {
  try {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [statsByStatus, monthPaid] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['status'],
        where: { userId },
        _sum: { amount: true },
        _count: true 
      }),
      prisma.invoice.aggregate({
        where: { userId, status: 'PAID', updatedAt: { gte: monthAgo } },
        _sum: { amount: true }
      }),
    ]);

    const stats = Object.fromEntries(statsByStatus.map(s => [s.status, { volume: s._sum.amount ?? 0, count: s._count }]));
    const totalVolume = Object.values(stats).reduce((acc, s) => acc + s.volume, 0);
    const paidVolume = stats['PAID']?.volume ?? 0;

    return {
      totalVolume,
      paidVolume,
      paidRate: totalVolume > 0 ? (paidVolume / totalVolume) : 0,
      paidThisMonth: monthPaid._sum.amount ?? 0,
      counts: {
        pending: stats['SENT']?.count ?? 0,
        paid: stats['PAID']?.count ?? 0,
        overdue: stats['OVERDUE']?.count ?? 0,
        abandoned: stats['CANCELLED']?.count ?? 0,
      }
    };
  } catch (err) {
    logger.error({ err }, 'Failed to compute invoice metrics');
    return { totalVolume: 0, paidVolume: 0, paidRate: 0, paidThisMonth: 0, counts: { pending: 0, paid: 0, overdue: 0, abandoned: 0 } };
  }
};

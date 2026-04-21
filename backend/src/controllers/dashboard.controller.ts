import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../utils/prisma.js';
import { successResponse } from '../utils/apiResponse.js';

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const [total, paid, overdue, pending] = await Promise.all([
      prisma.invoice.aggregate({ where: { userId }, _sum: { amount: true }, _count: true }),
      prisma.invoice.aggregate({ where: { userId, status: 'PAID' }, _sum: { amount: true }, _count: true }),
      prisma.invoice.aggregate({ where: { userId, status: 'OVERDUE' }, _count: true }),
      prisma.invoice.aggregate({ where: { userId, status: 'SENT' }, _count: true }),
    ]);

    const totalVolume = total._sum.amount ?? 0;
    const paidVolume = paid._sum.amount ?? 0;

    successResponse(res, {
      totalVolume,
      paidVolume,
      paidRate: totalVolume > 0 ? Math.round((paidVolume / totalVolume) * 100) : 0,
      counts: {
        pending: pending._count,
        paid: paid._count,
        overdue: overdue._count,
        abandoned: 0,
      },
      timeseries: [] // Placeholder
    });
  } catch (err) { next(err); }
};

export const getMetrics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [paidThisMonth, overdueCount] = await Promise.all([
      prisma.invoice.aggregate({
        where: { userId, status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.count({ where: { userId, status: 'OVERDUE' } }),
    ]);
    successResponse(res, {
      paidThisMonth: paidThisMonth._sum.amount ?? 0,
      paidCountThisMonth: paidThisMonth._count,
      overdueCount,
    });
  } catch (err) { next(err); }
};

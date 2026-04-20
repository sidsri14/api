import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../utils/prisma.js';
import { successResponse } from '../utils/apiResponse.js';

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const [total, paid, outstanding] = await Promise.all([
      prisma.invoice.aggregate({ where: { userId }, _sum: { amount: true }, _count: true }),
      prisma.invoice.aggregate({ where: { userId, status: 'PAID' }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { userId, status: { in: ['SENT', 'OVERDUE'] } }, _sum: { amount: true } }),
    ]);
    successResponse(res, {
      totalInvoicedCents: total._sum.amount ?? 0,
      totalCollectedCents: paid._sum.amount ?? 0,
      outstandingCents: outstanding._sum.amount ?? 0,
      invoiceCount: total._count,
    });
  } catch (err) { next(err); }
};

export const getMetrics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [thisMonth, overdue] = await Promise.all([
      prisma.invoice.aggregate({ where: { userId, createdAt: { gte: startOfMonth } }, _count: true }),
      prisma.invoice.count({ where: { userId, status: 'OVERDUE' } }),
    ]);
    successResponse(res, { invoicesThisMonth: thisMonth._count, overdueCount: overdue });
  } catch (err) { next(err); }
};

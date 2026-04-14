import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import pino from 'pino';
import { getPaymentsList, getPaymentDetails, triggerManualRetry } from '../services/payment.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { enqueueRecoveryJob } from '../jobs/recovery.queue.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, search, page, limit, sortKey, sortDir } = req.query;
    const result = await getPaymentsList(req.userId!, {
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Math.max(1, Number(page)) : 1,
      limit: limit ? Math.min(100, Math.max(1, Number(limit))) : 50,
      sortKey: sortKey ? String(sortKey) : 'createdAt',
      sortDir: sortDir ? String(sortDir) : 'desc',
    });
    successResponse(res, result);
  } catch (err) { next(err); }
};

export const getPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await getPaymentDetails(req.userId!, String(req.params.id || ''));
    successResponse(res, p);
  } catch (err: any) {
    if (err?.code === 'P2025') return errorResponse(res, 'Payment not found', 404);
    next(err);
  }
};

export const manualRetry = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '');
    if (!id) return errorResponse(res, 'ID required', 400);
    await triggerManualRetry(req.userId!, id);
    void enqueueRecoveryJob(id).catch((err) => logger.error({ failedPaymentId: id, err }, 'Manual retry enqueue failed'));
    successResponse(res, { message: 'Retry queued' });
  } catch (err) { next(err); }
};

export const exportPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../utils/prisma.js');
    const payments = await prisma.failedPayment.findMany({
      where: { userId: req.userId!, status: 'recovered' },
      orderBy: { recoveredAt: 'desc' },
      include: { event: { include: { source: true } } },
    });

    let csv = 'Date,Customer,Email,Amount,Currency,Source,Platform ID\n';
    payments.forEach(p => {
      const date = p.recoveredAt?.toISOString().split('T')[0] || p.createdAt.toISOString().split('T')[0];
      const name = (p.customerName || 'N/A').replace(/,/g, '');
      const email = p.customerEmail;
      const amt = (p.amount / 100).toFixed(2);
      const source = (p.event?.source?.name || p.event?.source?.provider || 'N/A').replace(/,/g, '');
      csv += `${date},${name},${email},${amt},${p.currency},${source},${p.paymentId}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=recovered_payments.csv');
    res.status(200).send(csv);
  } catch (err) { next(err); }
};

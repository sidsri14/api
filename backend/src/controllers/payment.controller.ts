import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { getPaymentsList, getPaymentDetails, triggerManualRetry } from '../services/payment.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { enqueueRecoveryJob } from '../jobs/recovery.queue.js';

export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, search, page, limit } = req.query;
    const result = await getPaymentsList(req.userId!, {
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Math.max(1, Number(page)) : 1,
      limit: limit ? Math.min(100, Math.max(1, Number(limit))) : 50,
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
    void enqueueRecoveryJob(id).catch(() => {}); // immediate job; fire-and-forget
    successResponse(res, { message: 'Retry queued' });
  } catch (err) { next(err); }
};

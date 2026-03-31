import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { PaymentService } from '../services/payment.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export const getPayments = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const result = await PaymentService.getPayments(req.userId!, { status, search, page, limit });
    successResponse(res, result);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 500);
  }
};

export const getPayment = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const payment = await PaymentService.getPaymentById(req.userId!, req.params['id'] as string);
    successResponse(res, payment);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 404);
  }
};

export const triggerManualRetry = async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
  try {
    await PaymentService.triggerManualRetry(req.userId!, req.params['id'] as string);
    successResponse(res, { message: 'Retry queued — worker will process on next tick' });
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 400);
  }
};

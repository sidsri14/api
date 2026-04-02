import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../utils/prisma.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAuditAction } from '../services/audit.service.js';
import { enqueueRecoveryJob } from '../jobs/recovery.queue.js';

export const simulateFailure = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = `pay_demo_${Math.random().toString(36).slice(7)}`;
    const p = await prisma.failedPayment.create({
      data: {
        userId: req.userId!,
        paymentId: id,
        orderId: `order_${Math.random().toString(36).slice(7)}`,
        customerName: 'Demo User',
        customerEmail: 'demo@example.com',
        customerPhone: '+919999999999',
        amount: 49900,
        currency: 'INR',
        status: 'pending',
        metadata: JSON.stringify({ error_code: 'DEMO', error_description: 'Simulated failure' }),
        nextRetryAt: new Date(Date.now() + 3600000),
      },
    });
    await logAuditAction(req.userId!, 'DEMO_FAILURE_SIMULATED', 'FailedPayment', p.id);
    void enqueueRecoveryJob(p.id).catch(() => {});
    successResponse(res, { message: 'Demo payment created', payment: p }, 201);
  } catch (err) { next(err); }
};

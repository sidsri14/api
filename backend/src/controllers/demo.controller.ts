import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAuditAction } from '../services/audit.service.js';
import { enqueueRecoveryJob } from '../jobs/recovery.queue.js';
import { StripeBillingService } from '../services/StripeBillingService.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

export const simulateFailure = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = `pay_demo_${Math.random().toString(36).slice(7)}`;
    // Look up real user for demo context
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    const email = user?.email || 'demo@example.com';

    const p = await prisma.failedPayment.create({
      data: {
        userId: req.userId!,
        paymentId: id,
        orderId: `order_${Math.random().toString(36).slice(7)}`,
        customerName: user?.name || 'Demo User',
        customerEmail: email,
        customerPhone: '+919999999999',
        amount: 49900,
        currency: 'INR',
        status: 'pending',
        metadata: JSON.stringify({ error_code: 'DEMO', error_description: 'Simulated failure' }),
        nextRetryAt: new Date(), // immediately eligible; BullMQ job also queued below
      },
    });
    await logAuditAction(req.userId!, 'DEMO_FAILURE_SIMULATED', 'FailedPayment', p.id);
    void enqueueRecoveryJob(p.id).catch((err) => logger.error({ failedPaymentId: p.id, err }, 'Demo job enqueue failed'));
    successResponse(res, { message: 'Demo payment created', payment: p }, 201);
  } catch (err) { next(err); }
};

export const simulateSuccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const p = await prisma.failedPayment.update({
      where: { id: id as string, userId: req.userId! },
      data: { status: 'recovered', recoveredAt: new Date(), recoveredVia: 'link' }
    });
    await logAuditAction(req.userId!, 'DEMO_SUCCESS_SIMULATED', 'FailedPayment', p.id);
    successResponse(res, { message: 'Demo success simulated', payment: p });
  } catch (err) { next(err); }
};

export const getPublicInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } }
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    successResponse(res, invoice);
  } catch (err) { next(err); }
};

export const initiatePublicPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { user: true }
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });

    const session = await StripeBillingService.createInvoiceSession(invoice, invoice.user);
    successResponse(res, session);
  } catch (err) { next(err); }
};

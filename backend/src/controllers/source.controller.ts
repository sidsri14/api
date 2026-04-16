import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { createPaymentSource, getPaymentSources, deletePaymentSource, validateSourceCredentials } from '../services/source.service.js';
import { logAuditAction } from '../services/audit.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { z } from 'zod';

const connectSchema = z.object({
  provider: z.enum(['razorpay', 'stripe']),
  name: z.string().max(100).optional(),
  credentials: z.record(z.string(), z.any()),
  webhookSecret: z.string().min(10).max(256),
});

export const connectSource = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Invalid request body', 400);

    const { provider, credentials } = parsed.data;

    // Validate credentials using the provider factory/adapter
    const isValid = await validateSourceCredentials(provider, credentials);
    if (!isValid) {
      return errorResponse(res, `Invalid ${provider} credentials`, 401);
    }

    const source = await createPaymentSource(req.userId!, parsed.data);
    await logAuditAction(req.userId!, 'SOURCE_CREATED', 'PaymentSource', source.id, { 
      name: source.name, 
      provider: source.provider 
    });
    
    successResponse(res, source, 201);
  } catch (err) { next(err); }
};

export const testConnection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { provider, credentials } = req.body;
    const ok = await validateSourceCredentials(provider, credentials);
    successResponse(res, { message: ok ? 'Verified!' : 'Failed' }, ok ? 200 : 401);
  } catch (err) { next(err); }
};

export const getSources = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    successResponse(res, await getPaymentSources(req.userId!));
  } catch (err) { next(err); }
};

export const deleteSource = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '');
    if (!id) return errorResponse(res, 'ID required', 400);
    await deletePaymentSource(req.userId!, id);
    await logAuditAction(req.userId!, 'SOURCE_DELETED', 'PaymentSource', id);
    successResponse(res, { deleted: true });
  } catch (err) { next(err); }
};

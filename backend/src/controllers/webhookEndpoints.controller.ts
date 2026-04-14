import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const VALID_EVENTS = [
  'payment.failed',
  'payment.retried',
  'payment.recovered',
  'payment.abandoned',
] as const;

const createSchema = z.object({
  url: z.string().url({ message: 'Must be a valid URL' }).max(2048),
  events: z.array(z.enum(VALID_EVENTS)).min(1, { message: 'Select at least one event' }),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(z.enum(VALID_EVENTS)).min(1).optional(),
  active: z.boolean().optional(),
});

/** GET /api/webhook-endpoints */
export const listEndpoints = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      select: { id: true, url: true, events: true, active: true, createdAt: true, updatedAt: true },
    });
    successResponse(res, endpoints);
  } catch (err) { next(err); }
};

/** POST /api/webhook-endpoints */
export const createEndpoint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);

    const { url, events, active } = parsed.data;
    const secret = crypto.randomBytes(32).toString('hex');

    const endpoint = await prisma.webhookEndpoint.create({
      data: { userId: req.userId!, url, events, active, secret },
      // Secret returned ONLY at creation — merchant must store it immediately
      select: { id: true, url: true, events: true, active: true, secret: true, createdAt: true },
    });

    successResponse(res, endpoint, 201);
  } catch (err) { next(err); }
};

/** PATCH /api/webhook-endpoints/:id */
export const updateEndpoint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '');
    const ep = await prisma.webhookEndpoint.findFirst({ where: { id, userId: req.userId! } });
    if (!ep) return errorResponse(res, 'Endpoint not found', 404);

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);

    const { url, events, active } = parsed.data;
    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(url !== undefined && { url }),
        ...(events !== undefined && { events }),
        ...(active !== undefined && { active }),
      },
      select: { id: true, url: true, events: true, active: true, updatedAt: true },
    });

    successResponse(res, updated);
  } catch (err) { next(err); }
};

/** DELETE /api/webhook-endpoints/:id */
export const deleteEndpoint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '');
    const ep = await prisma.webhookEndpoint.findFirst({ where: { id, userId: req.userId! } });
    if (!ep) return errorResponse(res, 'Endpoint not found', 404);

    await prisma.webhookEndpoint.delete({ where: { id } });
    successResponse(res, { deleted: true });
  } catch (err) { next(err); }
};

/** POST /api/webhook-endpoints/:id/test — fires a synthetic ping to the merchant URL */
export const testEndpoint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '');
    const ep = await prisma.webhookEndpoint.findFirst({
      where: { id, userId: req.userId! },
      select: { url: true, secret: true },
    });
    if (!ep) return errorResponse(res, 'Endpoint not found', 404);

    const payload = JSON.stringify({
      event: 'ping',
      data: { message: 'This is a test delivery from PayRecover.' },
      timestamp: new Date().toISOString(),
    });
    const sig = `sha256=${crypto.createHmac('sha256', ep.secret).update(payload).digest('hex')}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const r = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payrecover-signature': sig,
          'x-payrecover-event': 'ping',
        },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      successResponse(res, { status: r.status, ok: r.ok });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const reason = fetchErr?.name === 'AbortError' ? 'timeout' : (fetchErr?.message ?? 'unknown');
      errorResponse(res, `Delivery failed: ${reason}`, 502);
    }
  } catch (err) { next(err); }
};

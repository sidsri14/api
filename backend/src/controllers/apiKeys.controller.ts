import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const MAX_KEYS_PER_USER = 10;
const KEY_PREFIX = 'pr_';

/** SHA-256 hex hash — fast, good enough for long random API keys. */
const hashKey = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

const createSchema = z.object({
  name: z.string().min(1).max(100, { message: 'Name must be 100 chars or fewer' }),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

/** GET /api/api-keys */
export const listApiKeys = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, prefix: true, active: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    });
    successResponse(res, keys);
  } catch (err) { next(err); }
};

/** POST /api/api-keys */
export const createApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.apiKey.count({ where: { userId: req.userId! } });
    if (count >= MAX_KEYS_PER_USER) {
      return errorResponse(res, `Maximum of ${MAX_KEYS_PER_USER} API keys per account`, 400);
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);

    const rawKey = KEY_PREFIX + crypto.randomBytes(32).toString('hex'); // "pr_" + 64 hex chars
    const keyHash = hashKey(rawKey);
    const prefix = rawKey.slice(0, 11); // "pr_" + first 8 chars

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.userId!,
        name: parsed.data.name,
        keyHash,
        prefix,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
      select: { id: true, name: true, prefix: true, active: true, expiresAt: true, createdAt: true },
    });

    // rawKey returned ONLY at creation — merchant must store it immediately
    successResponse(res, { ...apiKey, key: rawKey }, 201);
  } catch (err) { next(err); }
};

/** PATCH /api/api-keys/:id — toggle active or rename */
export const updateApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '');
    const existing = await prisma.apiKey.findFirst({ where: { id, userId: req.userId! } });
    if (!existing) return errorResponse(res, 'API key not found', 404);

    const updateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      active: z.boolean().optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);

    const { name, active } = parsed.data;
    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(active !== undefined && { active }),
      },
      select: { id: true, name: true, prefix: true, active: true, lastUsedAt: true, expiresAt: true },
    });

    successResponse(res, updated);
  } catch (err) { next(err); }
};

/** DELETE /api/api-keys/:id */
export const deleteApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '');
    const existing = await prisma.apiKey.findFirst({ where: { id, userId: req.userId! } });
    if (!existing) return errorResponse(res, 'API key not found', 404);

    await prisma.apiKey.delete({ where: { id } });
    successResponse(res, { deleted: true });
  } catch (err) { next(err); }
};

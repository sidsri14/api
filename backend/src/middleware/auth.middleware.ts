import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';

const hashKey = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

export type AuthRequest = Request & {
  userId?: string;
  userPlan?: string; // Set by requireAuth; used by planAwareLimiter
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Priority 1: API key (x-api-key header or Bearer pr_... token)
  const rawApiKey = req.headers['x-api-key'] as string | undefined
    ?? (() => {
         const auth = req.headers.authorization;
         if (auth?.startsWith('Bearer pr_')) return auth.slice(7);
         return undefined;
       })();

  if (rawApiKey) {
    const kh = hashKey(rawApiKey);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: kh },
      select: { id: true, userId: true, active: true, expiresAt: true, user: { select: { plan: true } } },
    });

    if (!apiKey || !apiKey.active) {
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid or revoked API key' });
      return;
    }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      res.status(401).json({ success: false, error: 'Unauthorized: API key expired' });
      return;
    }

    req.userId = apiKey.userId;
    req.userPlan = apiKey.user.plan;

    // Fire-and-forget lastUsedAt update — never blocks the request
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    next();
    return;
  }

  // Priority 2: JWT in cookie
  let token = req.cookies?.token;

  // Priority 3: Authorization Bearer JWT
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.startsWith('Bearer pr_')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const decoded = verifyToken(token);

    // CRITICAL: Verify user still exists in the database
    // This handles cases where the DB was migrated/reset but the user has an old JWT
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, plan: true }
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized: User no longer exists' });
      return;
    }

    req.userId = decoded.userId;
    req.userPlan = user.plan;
    next();
  } catch (error) {
    // Log invalid token attempts for security monitoring
    const { logAuditAction } = await import('../services/audit.service.js');
    await logAuditAction('system', 'UNAUTHORIZED_ACCESS_ATTEMPT', 'Auth', 'none', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      error: 'Invalid token'
    }).catch(() => {});

    res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

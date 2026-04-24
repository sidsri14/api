import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware.js';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Uses default keyGenerator which is trust-proxy-aware and avoids IPv6 validation warnings
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: 'Rate limit exceeded. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Uses default keyGenerator
});

// ── Plan-aware rate limiters (keyed by userId, not IP) ────────────────────────
// Thresholds per plan:
//   free    →  60 req / min  (same as the flat apiLimiter)
//   starter → 200 req / min
//   pro     → 500 req / min
//
// These run AFTER requireAuth so req.userId and req.userPlan are always set.
// Using userId as the key means paid users are not penalised by shared IPs (NAT,
// corporate proxies) and free users can't borrow paid headroom.

const RATE_LIMITS: Record<string, number> = {
  free: 60,
  starter: 200,
  pro: 500,
};

const planLimiters = Object.fromEntries(
  Object.entries(RATE_LIMITS).map(([plan, max]) => [
    plan,
    rateLimit({
      windowMs: 60 * 1000,
      max,
      message: { success: false, error: 'Rate limit exceeded. Please slow down.' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        // userId is guaranteed after requireAuth middleware
        return (req as AuthRequest).userId || 'anonymous';
      },
    }),
  ])
);

/**
 * Drop-in replacement for `apiLimiter` on authenticated routes.
 * Must be placed AFTER `requireAuth` in the middleware chain so that
 * `req.userId` and `req.userPlan` are available.
 */
export const planAwareLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'development') return next();
  const plan = (req as AuthRequest).userPlan ?? 'free';
  const limiter = planLimiters[plan] ?? planLimiters['free']!;
  limiter(req, res, next);
};


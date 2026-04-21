import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

/**
 * Validates the double-submit CSRF pattern:
 * 1. Server sets a non-HttpOnly `csrf-token` cookie on first visit.
 * 2. Client reads it and echoes it back in the `x-csrf-token` request header.
 * 3. This middleware confirms the cookie and header values match.
 *
 * Combined with SameSite=Strict cookies (the auth JWT), this provides two
 * independent layers of CSRF protection.
 *
 * Uses timingSafeEqual to prevent timing-based token enumeration.
 */
export const csrfCheck = (req: Request, res: Response, next: NextFunction): void => {
  const cookieToken = req.cookies?.['csrf-token'];
  const headerToken = String(req.headers['x-csrf-token'] ?? '');

  const cookieBuf = cookieToken ? Buffer.from(cookieToken) : null;
  const headerBuf = headerToken.length > 0 ? Buffer.from(headerToken) : null;
  const valid = cookieBuf !== null &&
    headerBuf !== null &&
    cookieBuf.byteLength === headerBuf.byteLength &&
    crypto.timingSafeEqual(cookieBuf, headerBuf);

  if (!valid) {
    // Distinguish missing token (likely a dev/tool mistake) from a wrong token
    // (potential CSRF attack — client has a token but it doesn't match).
    const reason = !cookieToken
      ? 'missing_cookie'
      : !headerToken
        ? 'missing_header'
        : 'token_mismatch';

    logger.warn({
      reason,
      method: req.method,
      path: req.path,
      ip: req.ip,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
    }, `CSRF validation failed: ${reason}`);

    res.status(403).json({ success: false, error: 'Invalid CSRF token' });
    return;
  }
  next();
};

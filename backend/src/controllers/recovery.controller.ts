import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { logAuditAction } from '../services/audit.service.js';

/**
 * Handle recovery link click tracking.
 * Redirects to the actual payment link while logging analytics.
 */
export const trackClick = async (req: Request, res: Response) => {
  const failedPaymentId = String(req.params.failedPaymentId || '');

  try {
    const payment = await prisma.failedPayment.findUnique({
      where: { id: failedPaymentId },
      include: { recoveryLinks: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    if (!payment || !payment.recoveryLinks[0]) {
      return res.status(404).json({ error: 'Recovery link not found' });
    }

    // 1. Gather Analytics Metadata
    const userAgentRaw = req.headers['user-agent'];
    const userAgent = Array.isArray(userAgentRaw) ? userAgentRaw[0] : (userAgentRaw || 'Unknown');
    
    // X-Forwarded-For can be a string, array, or undefined. Handle all cases.
    const xForwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(xForwardedFor) ? xForwardedFor[0] : (xForwardedFor || '');
    const ip = forwardedIp || req.socket.remoteAddress || 'Unknown';

    // 2. Increment click count and log metadata
    await prisma.failedPayment.update({
      where: { id: failedPaymentId },
      data: { clickCount: { increment: 1 } }
    });

    // 3. Log detailed audit event
    await logAuditAction(payment.userId, 'PAYMENT_LINK_CLICKED', 'FailedPayment', failedPaymentId, { 
      email: payment.customerEmail,
      ip,
      userAgent,
      platform: userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'
    });

    // 4. Redirect to the source provider's actual recovery link
    const recoveryLink = (payment as any).recoveryLinks?.[0];
    if (!recoveryLink) {
      return res.status(404).json({ error: 'Source recovery link not found' });
    }
    res.redirect(recoveryLink.url);
  } catch (err) {
    console.error('Track Click Error:', err);
    res.status(500).json({ error: 'Failed to process redirect' });
  }
};

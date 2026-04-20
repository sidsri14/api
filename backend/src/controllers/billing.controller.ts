import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { BillingService } from '../services/BillingService.js';
import { StripeBillingService } from '../services/StripeBillingService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

/**
 * Controller for platform-level billing and subscriptions.
 * Day 1-2 of Monetization Roadmap.
 */
export const createSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { plan, gateway } = req.body; // "starter" or "pro", "razorpay" or "stripe"

    const result = await BillingService.createSubscription(req.userId!, plan as 'starter' | 'pro', gateway);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getSubscriptionStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../utils/prisma.js');
    const [user, subscription] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.userId! },
        select: { plan: true },
      }),
      prisma.subscription.findFirst({
        where: { userId: req.userId!, status: { in: ['active', 'authenticated', 'created'] } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          provider: true,
          providerSubscriptionId: true,
          plan: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelledAt: true,
          createdAt: true,
        },
      }),
    ]);
    successResponse(res, { plan: user?.plan ?? 'free', subscription });
  } catch (err) {
    next(err);
  }
};

/**
 * Directly updates the user's plan.
 * For production this should go through the Razorpay subscription webhook flow,
 * but this endpoint allows manual plan changes for dev/support scenarios.
 */
export const updatePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { plan } = req.body;
    const { prisma } = await import('../utils/prisma.js');
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { plan },
      select: { id: true, email: true, plan: true, createdAt: true },
    });
    successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

/**
 * Public webhook endpoint for Razorpay subscription events.
 * Securely verified with 'x-razorpay-signature'.
 */
export const billingWebhook = async (req: any, res: Response, next: NextFunction) => {
  try {
    const sig = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (typeof sig !== 'string' || !webhookSecret) {
      logger.warn('[Billing Webhook] Missing signature or webhook secret not configured');
      return errorResponse(res, 'Invalid signature', 400);
    }

    const rawBody = (req.body as Buffer).toString('utf8');
    logger.debug({ secret_len: webhookSecret.length }, '[Billing Webhook] Received');

    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const isValid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    logger.debug({ isValid }, '[Billing Webhook] Signature check result');

    if (!isValid) {
      return errorResponse(res, 'Invalid signature', 400);
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.warn('[Billing Webhook] Malformed JSON body');
      return errorResponse(res, 'Invalid request body', 400);
    }
    await BillingService.handleSubscriptionWebhook(event);

    successResponse(res, { success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Public webhook endpoint for Stripe platform subscription events.
 */
export const stripeBillingWebhook = async (req: any, res: Response, next: NextFunction) => {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return errorResponse(res, 'Missing signature', 400);
    }

    // Note: stripe.webhooks.constructEvent requires the raw body as a Buffer.
    // Ensure the middleware (src/app.ts) preserves the raw body for this route.
    const event = await StripeBillingService.verifyWebhookSignature(req.body, sig);
    await StripeBillingService.handleWebhook(event);

    successResponse(res, { received: true });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Stripe Billing Webhook] Failed');
    errorResponse(res, `Webhook Error: ${err.message}`, 400);
  }
};

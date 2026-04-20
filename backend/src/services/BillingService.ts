import { prisma } from '../utils/prisma.js';
import { StripeBillingService } from './StripeBillingService.js';

const PLAN_IDS = {
  starter: process.env.RAZORPAY_STARTER_PLAN_ID,
  pro: process.env.RAZORPAY_PRO_PLAN_ID,
} as const;

export class BillingService {
  /**
   * Creates a checkout session or subscription for a plan using the specified gateway.
   */
  static async createSubscription(userId: string, plan: 'starter' | 'pro', gateway: 'razorpay' | 'stripe' = 'razorpay') {
    if (gateway === 'stripe') {
      return StripeBillingService.createCheckoutSession(userId, plan);
    }

    // Razorpay Fallback (Legacy/India)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { status: 404, message: 'User not found' };

    const planId = PLAN_IDS[plan];
    if (!planId) {
      throw { status: 500, message: `Razorpay Plan ID for '${plan}' is not configured on the server.` };
    }

    throw { status: 400, message: 'Razorpay subscriptions are no longer supported. Use Stripe billing.' };
    const subscription = { id: '' }; // unreachable, satisfies type

    await prisma.subscription.create({
      data: {
        userId,
        providerSubscriptionId: subscription.id,
        provider: 'razorpay',
        plan,
        status: 'created',
      },
    });

    return {
      subscriptionId: subscription.id,
      url: subscription.short_url,
    };
  }

  /**
   * Processes Razorpay subscription webhooks to keep local records and plan levels in sync.
   */
  static async handleSubscriptionWebhook(event: any) {
    const sub = event?.payload?.subscription?.entity;
    if (!sub?.id) return; // Not a subscription event or malformed payload

    const providerSubscriptionId = sub.id;

    const existing = await prisma.subscription.findUnique({
      where: { providerSubscriptionId },
    });

    if (!existing) return; // Ignore webhooks for unknown subscriptions

    let newStatus = existing.status;
    let cancelledAt = existing.cancelledAt;

    switch (event.event) {
      case 'subscription.authenticated':
        newStatus = 'authenticated';
        break;
      case 'subscription.activated':
        newStatus = 'active';
        // Upgrade user plan level
        await prisma.user.update({
          where: { id: existing.userId },
          data: { plan: existing.plan },
        });
        break;
      case 'subscription.charged':
        newStatus = 'active'; // Recurring charge success
        break;
      case 'subscription.cancelled':
      case 'subscription.completed':
        newStatus = 'cancelled';
        cancelledAt = new Date();
        // Reset user to free plan
        await prisma.user.update({
          where: { id: existing.userId },
          data: { plan: 'free' },
        });
        break;
    }

    await prisma.subscription.update({
      where: { providerSubscriptionId },
      data: {
        status: newStatus,
        cancelledAt,
        currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : undefined,
        currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : undefined,
      },
    });
  }

  /**
   * Gets the most recent active/authenticated subscription for a user.
   */
  static async getUserSubscription(userId: string) {
    return prisma.subscription.findFirst({
      where: { userId, status: { in: ['active', 'authenticated'] } },
      orderBy: { createdAt: 'desc' },
    });
  }
}

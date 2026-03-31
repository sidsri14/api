import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { PaymentService } from '../services/payment.service.js';
import { RazorpayService } from '../services/razorpay.service.js';
import { sendPaymentFailedEmail } from '../services/email.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { prisma } from '../utils/prisma.js';
import crypto from 'crypto';

const DEMO_AMOUNTS = [49900, 99900, 199900, 299900, 499900]; // ₹499, ₹999, ₹1999, ₹2999, ₹4999
const DEMO_NAMES = ['Arjun Sharma', 'Priya Patel', 'Rahul Verma', 'Sneha Iyer', 'Vikram Nair'];
const DEMO_PRODUCTS = ['Pro Plan', 'Business Plan', 'Enterprise Plan', 'Annual Subscription', 'Starter Pack'];

export const simulateFailure = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    const idx = Math.floor(Math.random() * DEMO_AMOUNTS.length);
    const amount = DEMO_AMOUNTS[idx] ?? DEMO_AMOUNTS[0]!;
    const name = DEMO_NAMES[idx] ?? DEMO_NAMES[0]!;
    const product = DEMO_PRODUCTS[idx] ?? DEMO_PRODUCTS[0]!;
    const demoPaymentId = `pay_DEMO_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    const payment = await PaymentService.createFailedPayment(userId, {
      paymentId: demoPaymentId,
      amount,
      currency: 'INR',
      customerEmail: user.email,
      customerName: name,
      metadata: JSON.stringify({
        demo: true,
        description: product,
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Your payment has been declined.',
      }),
    });

    // Instant recovery attempt — create Razorpay payment link immediately so
    // the user sees the full failure→recovery flow without waiting for the worker.
    let paymentLink: string | undefined;
    try {
      paymentLink = await RazorpayService.createPaymentLink(
        process.env.RAZORPAY_KEY_ID!,
        process.env.RAZORPAY_KEY_SECRET!,
        {
          amount,
          currency: 'INR',
          customerName: name,
          customerEmail: user.email,
          description: `Recovery link for ${product}`,
          referenceId: payment.id,
        }
      );
      await PaymentService.createRecoveryLink(payment.id, paymentLink);
      void sendPaymentFailedEmail(user.email, {
        customerName: name,
        amount,
        currency: 'INR',
        paymentLink,
        paymentId: demoPaymentId,
      }).catch(() => {/* non-fatal */});
      await PaymentService.recordReminder(payment.id, 0, 'email');
      await PaymentService.incrementRetry(payment.id);
    } catch {
      // Non-fatal — payment exists, worker will retry on next tick
    }

    successResponse(res, {
      id: payment.id,
      paymentId: demoPaymentId,
      amount,
      customerName: name,
      product,
      paymentLink,
      message: paymentLink
        ? 'Recovery link created — customer emailed instantly.'
        : 'Demo payment failure created. Worker will process on next tick.',
    }, 201);
  } catch (error: any) {
    next(error);
  }
};

export const simulateRecovery = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const payment = await prisma.failedPayment.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!payment) {
      errorResponse(res, 'Payment not found', 404);
      return;
    }
    if (payment.status === 'recovered') {
      errorResponse(res, 'Payment already recovered', 400);
      return;
    }
    await PaymentService.markRecovered(id, 'external');
    successResponse(res, { recovered: true, paymentId: payment.paymentId });
  } catch (error: any) {
    next(error);
  }
};

import { Router } from 'express';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { handleUnifiedWebhook, handleStripeInvoiceWebhook } from '../controllers/webhook.controller.js';

const router = Router({ mergeParams: true });

// Rate limit per source to prevent webhook flood / DoS.
// Razorpay retries failed webhooks up to 3 times, so 30/min per source is generous.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `${req.ip ?? 'unknown'}-${req.params['sourceId'] ?? ''}`,
  message: { error: 'Too many webhook requests' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

router.post('/:provider/:sourceId', webhookLimiter, express.raw({ type: 'application/json', limit: '100kb' }), handleUnifiedWebhook);

export default router;

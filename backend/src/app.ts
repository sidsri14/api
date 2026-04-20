import 'dotenv/config';
import * as Sentry from "@sentry/bun";
import crypto from 'crypto';
import express from 'express';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import billingRoutes from './routes/billing.routes.js';
import teamRoutes from './routes/team.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import webhookEndpointRoutes from './routes/webhookEndpoints.routes.js';
import apiKeyRoutes from './routes/apiKeys.routes.js';
import auditRoutes from './routes/audit.routes.js';
import contactRoutes from './routes/contact.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import clientRoutes from './routes/client.routes.js';
import { Queue } from 'bullmq';
import { billingWebhook, stripeBillingWebhook } from './controllers/billing.controller.js';
import { handleStripeInvoiceWebhook } from './controllers/webhook.controller.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { prisma } from './utils/prisma.js';
import { redisConnection } from './jobs/recovery.queue.js';
import './config/passport.js';
import passport from 'passport';

import cors from 'cors';

const app = express();
app.use(passport.initialize());

// Log CORS configuration on startup
const rawAllowed = process.env.ALLOWED_ORIGINS || '';
const parsedAllowed = rawAllowed.split(',').map(o => o.trim()).filter(Boolean);
logger.info({ rawAllowed, parsedAllowed }, 'CORS Configuration Initialized');

// Build CSP connect-src from env so it stays valid across domain changes
const cspConnectSrc = ["'self'", ...parsedAllowed, 'http://localhost:5173'].filter(Boolean);

// Enable trust proxy for correct IP detection in cloud environments
app.set('trust proxy', 1);

// 1. CORS Middleware (Standard for Cross-Domain Vercel <-> Railway)
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    const whitelist = [...allowed, 'http://localhost:5173'];
    
    if (!origin || whitelist.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// 2. Security Middleware (Standard Hardening)
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: cspConnectSrc,
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(morgan('dev'));
app.use(cookieParser());

// Webhook routes
app.post('/api/webhooks/billing/razorpay', express.raw({ type: 'application/json' }), billingWebhook);
app.post('/api/webhooks/billing/stripe', express.raw({ type: 'application/json' }), stripeBillingWebhook);
app.post('/api/webhooks/stripe/invoice', express.raw({ type: 'application/json' }), handleStripeInvoiceWebhook);

// General purpose body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Global rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  validate: false, // Disable internal validation checks to prevent startup warnings
});

app.use('/api/', globalLimiter);

// CSRF Token — issues a non-HttpOnly cookie that the frontend echoes back
// as x-csrf-token on every state-changing request (double-submit pattern).
// Validated in csrf.middleware.ts, applied per-route.
app.get('/api/csrf-token', (_req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  const isProd = process.env.NODE_ENV !== 'development';
  res.cookie('csrf-token', token, {
    httpOnly: false,
    // Cross-origin (Vercel → Railway): SameSite=None is required so the browser
    // sends the cookie back on cross-site requests. Requires Secure=true.
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 3600000,
  });
  res.json({ token });
});

// Health Check
const HEARTBEAT_KEY = 'stripepay:worker:heartbeat';
const WORKER_STALE_MS = 150_000; // matches worker TTL

app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { database: 'unknown', redis: 'unknown', stripe: 'unknown', worker: 'unknown' };
  let healthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
    healthy = false;
  }

  try {
    await redisConnection.ping();
    checks.redis = 'connected';

    // Worker heartbeat check
    const hb = await redisConnection.get(HEARTBEAT_KEY);
    if (!hb) {
      checks.worker = 'offline';
      healthy = false;
    } else {
      const age = Date.now() - parseInt(hb, 10);
      checks.worker = age < WORKER_STALE_MS ? 'online' : 'stale';
      if (checks.worker !== 'online') healthy = false;
    }
  } catch {
    checks.redis = 'disconnected';
    checks.worker = 'unknown';
    healthy = false;
  }

  const stripeKey = process.env.STRIPE_PLATFORM_SECRET_KEY || '';
  checks.stripe = stripeKey.startsWith('sk_') ? 'configured' : 'missing';
  if (checks.stripe === 'missing') healthy = false;

  res.status(200).json({
    status: healthy ? 'ok' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ...checks,
  });
});

// Queue Stats (authenticated — for dashboard use)
app.get('/api/queue/stats', requireAuth, async (req, res) => {
  try {
    const queue = new Queue('payment-recovery', { connection: redisConnection });
    const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed');
    const hb = await redisConnection.get(HEARTBEAT_KEY);
    const workerAge = hb ? Date.now() - parseInt(hb, 10) : null;
    await queue.close();
    res.json({
      success: true,
      data: {
        queue: counts,
        worker: {
          status: !hb ? 'offline' : workerAge! < WORKER_STALE_MS ? 'online' : 'stale',
          lastSeenMs: workerAge,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to read queue stats' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/webhook-endpoints', webhookEndpointRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/security', auditRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/clients', clientRoutes);

// Error Handling
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, requestId: req.headers['x-request-id'] }, 'Unhandled error');
  Sentry.captureException(err);
  const status = err.status || 500;
  // Never expose internal error details on 5xx — only log them server-side
  const message = status < 500 ? (err.message || 'Bad Request') : 'Internal Server Error';
  res.status(status).json({
    success: false,
    error: message,
    requestId: req.headers['x-request-id']
  });
});

export { app };

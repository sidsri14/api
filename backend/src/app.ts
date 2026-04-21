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
import { stripeBillingWebhook } from './controllers/billing.controller.js';
import { handleStripeInvoiceWebhook } from './controllers/webhook.controller.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { prisma } from './utils/prisma.js';
import { redisConnection } from './jobs/recovery.queue.js';
import './config/passport.js';
import passport from 'passport';
import demoRoutes from './routes/demo.routes.js';

import cors from 'cors';

const app = express();
app.use(passport.initialize());

// Log CORS configuration on startup
const rawAllowed = process.env.ALLOWED_ORIGINS || '';
const parsedAllowed = rawAllowed.split(',').map(o => o.trim()).filter(Boolean);
logger.info({ rawAllowed, parsedAllowed }, 'CORS Configuration Initialized');

// Enable trust proxy for correct IP detection in cloud environments
app.set('trust proxy', 1);

// ── Security & CSP
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://resend.com", ...parsedAllowed, 'http://localhost:5173'],
      frameSrc: ["'self'", "https://checkout.stripe.com"],
      imgSrc: ["'self'", "data:", "https://*.stripe.com", "https://resend.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
    },
  },
}));

app.use(morgan('dev'));
app.use(cookieParser());

// ── CORS Middleware
app.use(cors({
  origin: (origin, callback) => {
    const whitelist = [...parsedAllowed, 'http://localhost:5173', 'http://localhost:5174'];
    const isDev = process.env.NODE_ENV === 'development';
    // No wildcard *.vercel.app — only explicitly listed origins are trusted.
    // In dev, any localhost port is allowed for convenience.
    if (!origin || whitelist.includes(origin) || (isDev && origin.startsWith('http://localhost:'))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-api-key'],
  optionsSuccessStatus: 200
}));

// ── Webhook Routes (Raw Body Required)
app.post('/api/webhooks/billing/stripe', express.raw({ type: 'application/json' }), stripeBillingWebhook);
app.post('/api/webhooks/stripe/invoice', express.raw({ type: 'application/json' }), handleStripeInvoiceWebhook);

// ── Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

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
const HEARTBEAT_KEY = 'stripeflow:worker:heartbeat';
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

// Singleton queue for stats — avoids opening a new connection on every request
const statsQueue = new Queue('payment-recovery', { connection: redisConnection });

// Queue Stats (authenticated — for dashboard use)
app.get('/api/queue/stats', requireAuth, async (_req, res) => {
  try {
    const counts = await statsQueue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed');
    const hb = await redisConnection.get(HEARTBEAT_KEY);
    const workerAge = hb ? Date.now() - parseInt(hb, 10) : null;
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
app.use('/api/demo', demoRoutes);

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
export default app;

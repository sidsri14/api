import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import billingRoutes from './routes/billing.routes.js';
import demoRoutes from './routes/demo.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import sourceRoutes from './routes/source.routes.js';
import { billingWebhook } from './controllers/billing.controller.js';
import { prisma } from './utils/prisma.js';
import { redisConnection } from './jobs/recovery.queue.js';

const app = express();

// Enable trust proxy for correct IP detection in cloud environments
app.set('trust proxy', 1);

// 1. CORS Middleware (Must be at the very top for preflight requests)
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
    // Auto-allow localhost and the configured production sites
    const whitelist = [...allowed, 'http://localhost:5173'];

    if (!origin || whitelist.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
}));

// 2. Security Middleware
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", "https://pay-recover-web-production.up.railway.app", "https://pay-recover.vercel.app"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(morgan('dev'));
app.use(cookieParser());

// Webhook routes need raw body for signature verification
app.use('/api/webhooks/razorpay', webhookRoutes);
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhook);

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
    sameSite: isProd ? 'none' : 'strict',
    secure: isProd,
    maxAge: 7 * 24 * 3600000,
  });
  res.json({ token });
});

// Health Check
app.get('/health', async (_req, res) => {
  const checks = { database: 'unknown', redis: 'unknown', razorpay: 'unknown' };
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
  } catch {
    checks.redis = 'disconnected';
    healthy = false;
  }

  const keyId = process.env.RAZORPAY_KEY_ID || '';
  checks.razorpay = keyId.startsWith('rzp_') ? 'configured' : 'missing';
  if (checks.razorpay === 'missing') healthy = false;

  res.status(200).json({
    status: healthy ? 'ok' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ...checks,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sources', sourceRoutes);

// Error Handling
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, requestId: req.headers['x-request-id'] }, 'Unhandled error');
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

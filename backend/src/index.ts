import * as Sentry from "@sentry/bun";
import { app } from './app.js';
import { prisma } from './utils/prisma.js';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

const port = process.env.PORT || 3000;

const REQUIRED_ENV = [
  'JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL',
] as const;

const OPTIONAL_ENV: Array<{ key: string; impact: string }> = [
  { key: 'SMTP_HOST',          impact: 'Recovery emails will not be sent (console-only mode)' },
  { key: 'TWILIO_SID',         impact: 'Pro-plan SMS recovery on 3rd attempt will be skipped' },
  { key: 'TWILIO_AUTH_TOKEN',  impact: 'Pro-plan SMS recovery on 3rd attempt will be skipped' },
  { key: 'TWILIO_FROM_NUMBER', impact: 'Pro-plan SMS recovery on 3rd attempt will be skipped' },
  { key: 'SENTRY_DSN',         impact: 'Error monitoring will be disabled' },
  { key: 'RAZORPAY_KEY_ID',   impact: 'Global Razorpay credentials unavailable — per-source keys still work' },
  { key: 'RAZORPAY_KEY_SECRET', impact: 'Global Razorpay credentials unavailable — per-source keys still work' },
];

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    console.error('[Startup] JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  const encKey = process.env.ENCRYPTION_KEY!;
  if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    console.error('[Startup] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes for AES-256). Generate with: openssl rand -hex 32');
    process.exit(1);
  }

  // Warn about optional vars that degrade functionality
  const missingOptional = OPTIONAL_ENV.filter(({ key }) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn('[Startup] Optional environment variables not set:');
    missingOptional.forEach(({ key, impact }) =>
      console.warn(`  ⚠  ${key}: ${impact}`)
    );
  }
}
validateEnv();

const server = app.listen(port, () => {
  console.log(`InvoiceFlow server running on port ${port}`);
});

// ── Graceful Shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // 1. Stop accepting new requests
  server.close(() => {
    console.log('HTTP server closed.');
  });

  try {
    // 2. Disconnect from DB
    await prisma.$disconnect();
    console.log('Prisma disconnected.');
    
    // Give inflight operations a moment to finish
    setTimeout(() => {
      console.log('Graceful shutdown complete.');
      process.exit(0);
    }, 1000);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

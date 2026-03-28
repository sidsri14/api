import { prisma } from './utils/prisma.js';
import { sendAlertEmail } from './services/email.service.js';
import pLimit from 'p-limit';
import pino from 'pino';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import type { Monitor } from '@prisma/client';
import { validateUrlForSSRF, createSafeAgent } from './utils/security.js';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const CHECK_INTERVAL_MS = 10 * 1000; 
const limit = pLimit(15); 
let isShuttingDown = false;
let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let cleanupHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Enhanced fetch with Safe Agent and Body Size Limiting (10KB)
 */
const fetchWithAgent = (urlStr: string, method: string): Promise<{ status: number; ok: boolean; responseTime: number; location?: string }> => {
  const startTime = performance.now();
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === 'https:';
      const agent = createSafeAgent(isHttps ? 'https' : 'http');
      const lib = isHttps ? https : http;

      const req = lib.request(
        { 
          hostname: parsed.hostname, 
          port: parsed.port || (isHttps ? 443 : 80), 
          path: parsed.pathname + parsed.search, 
          method, 
          agent,
          timeout: 10000,
          headers: {
            'User-Agent': 'AntiGravity-Monitor/1.0',
            'Accept': '*/*'
          }
        },
        (res) => {
          const status = res.statusCode ?? 0;
          const location = res.headers.location;

          // Resource Protection: Limit body size to 10KB
          let bodySize = 0;
          res.on('data', (chunk) => {
            bodySize += chunk.length;
            if (bodySize > 10240) { // 10KB
              req.destroy();
              resolve({ 
                status, 
                ok: status >= 200 && status < 300,
                responseTime: Math.round(performance.now() - startTime),
                location: status >= 300 && status < 400 ? location : undefined
              });
            }
          });

          res.on('end', () => {
            resolve({ 
              status, 
              ok: status >= 200 && status < 300,
              responseTime: Math.round(performance.now() - startTime),
              location: status >= 300 && status < 400 ? location : undefined
            });
          });
        }
      );

      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout (10s)')); });
      req.on('error', (err) => reject(err));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Handle redirects safely with SSRF re-validation at each hop
 */
const safeFetchWithRedirects = async (initialUrl: string, method: string) => {
  let currentUrl = initialUrl;
  let hops = 0;
  const maxHops = 5;

  while (hops < maxHops) {
    // 1. Validate SSRF for current hop
    const isSafe = await validateUrlForSSRF(currentUrl);
    if (!isSafe) throw new Error(`SSRF Block: Hop ${hops} target is in forbidden IP range.`);

    const result = await fetchWithAgent(currentUrl, method);
    
    // 2. Terminate if not a redirect or no location header
    if (!result.location) return result;

    // 3. Resolve internal vs external locations
    const nextUrl = new URL(result.location, currentUrl).toString();
    currentUrl = nextUrl;
    hops++;
    logger.debug(`Following safe redirect ${hops}: ${currentUrl}`);
  }

  throw new Error(`Too many redirects (Max ${maxHops})`);
};

const executeCheck = async (monitor: Monitor) => {
  let statusCode: number | null = null;
  let responseTime: number | null = null;
  let status = 'DOWN';
  let errorMsg: string | null = null;

  try {
    const result = await safeFetchWithRedirects(monitor.url, monitor.method);
    statusCode = result.status;
    responseTime = result.responseTime;
    status = result.ok ? 'UP' : 'DOWN';
    if (!result.ok) errorMsg = `HTTP ${statusCode}`;
  } catch (error) {
    errorMsg = (error as Error).message;
    status = 'DOWN';
    logger.warn(`Check failed for ${monitor.url}: ${errorMsg}`);
  }

  // Strike Policy & Persistence
  const previousStatus = monitor.status;
  const isCurrentlyUp = status === 'UP';
  const currentFailureCount = (monitor as any).failureCount ?? 0;
  let nextFailureCount = isCurrentlyUp ? 0 : currentFailureCount + 1;
  const effectiveStatus = (nextFailureCount >= 3) ? 'DOWN' : (isCurrentlyUp ? 'UP' : previousStatus);
  const statusChanged = previousStatus !== effectiveStatus;

  try {
    await prisma.$transaction([
      prisma.monitor.update({
        where: { id: monitor.id },
        data: { status: effectiveStatus, failureCount: nextFailureCount, lastCheckedAt: new Date() }
      }),
      prisma.log.create({
        data: { monitorId: monitor.id, status, statusCode, responseTime }
      })
    ]);
  } catch (err) {
    logger.error(`Persistence failed: ${(err as Error).message}`);
  }

  // Alerts & Incidents
  if (effectiveStatus === 'DOWN' || statusChanged) {
    await handleIncidentAndAlert(monitor, effectiveStatus, statusChanged, errorMsg, statusCode);
  }
};

const handleIncidentAndAlert = async (monitor: Monitor, effectiveStatus: string, statusChanged: boolean, errorMsg: string | null, statusCode: number | null) => {
  if (effectiveStatus === 'DOWN') {
    const existing = await prisma.incident.findFirst({ where: { monitorId: monitor.id, resolvedAt: null } });
    if (!existing) {
      await prisma.incident.create({ 
        data: { monitorId: monitor.id, cause: errorMsg || 'Connection error', status: 'INVESTIGATING' } as any 
      });
    }

    const cooldown = new Date(Date.now() - 15 * 60 * 1000);
    const recent = await prisma.alert.findFirst({ where: { monitorId: monitor.id, sentAt: { gte: cooldown } } });
    if (!recent) {
      await prisma.alert.create({ data: { monitorId: monitor.id, type: 'EMAIL' } });
      const project = await prisma.project.findUnique({ where: { id: monitor.projectId }, include: { user: true } });
      if (project?.user?.email) {
        sendAlertEmail(project.user.email, monitor.url, 'DOWN', statusCode).catch(() => {});
      }
    }
  } else if (effectiveStatus === 'UP' && statusChanged) {
    const open = await prisma.incident.findMany({ where: { monitorId: monitor.id, resolvedAt: null } });
    for (const inc of open) {
      const resolvedAt = new Date();
      const durationSecs = Math.floor((resolvedAt.getTime() - inc.startedAt.getTime()) / 1000);
      await prisma.incident.update({ where: { id: inc.id }, data: { resolvedAt, durationSecs, status: 'RESOLVED' } as any });
    }
  }
};

const cleanupOldData = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const logsDeleted = await prisma.log.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } });
    const alertsDeleted = await prisma.alert.deleteMany({ where: { sentAt: { lt: thirtyDaysAgo } } });
    if (logsDeleted.count > 0 || alertsDeleted.count > 0) {
      logger.info(`Housekeeping: Purged ${logsDeleted.count} logs and ${alertsDeleted.count} alerts older than 30 days.`);
    }
  } catch (error) {
    logger.error(`Housekeeping failed: ${(error as Error).message}`);
  }
};

const checkMonitors = async () => {
  if (isShuttingDown) return;
  try {
    const monitors = await prisma.monitor.findMany({
      where: {
        AND: [
          { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 10 * 1000) } }] },
          { OR: [{ maintenanceUntil: null }, { maintenanceUntil: { lt: new Date() } }] }
        ]
      }
    });

    const now = Date.now();
    const batch = monitors.filter(m => !m.lastCheckedAt || now >= m.lastCheckedAt.getTime() + (m.interval * 1000));
    
    if (batch.length > 0) {
      logger.info(`Tick: Processing ${batch.length} monitors.`);
      await Promise.all(batch.map(m => limit(() => executeCheck(m))));
    }
  } catch (error) {
    logger.error(error, "Batch failed.");
  } finally {
    if (!isShuttingDown) timeoutHandle = setTimeout(checkMonitors, CHECK_INTERVAL_MS);
  }
};

const startWorker = () => {
  logger.info('Reliable Monitor Worker v2.0 - Active');
  checkMonitors();
  cleanupHandle = setInterval(cleanupOldData, 24 * 60 * 60 * 1000); // Once a day
  cleanupOldData(); // Initial run
};

startWorker();

const shutdown = async (signal: string) => {
  logger.info(`Shutting down (${signal})...`);
  isShuttingDown = true;
  if (timeoutHandle) clearTimeout(timeoutHandle);
  if (cleanupHandle) clearInterval(cleanupHandle);
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

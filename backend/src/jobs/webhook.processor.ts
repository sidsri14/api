import type { Job } from 'bullmq';
import crypto from 'crypto';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';
import { isPrivateUrl } from '../utils/isPrivateUrl.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

const DISPATCH_TIMEOUT_MS = 10_000;

export async function processWebhookDeliveryJob(job: Job): Promise<void> {
  const { endpointId, url, event, body } = job.data as {
    endpointId: string;
    url: string;
    event: string;
    body: string;
  };

  // Fetch the signing secret from the DB at dispatch time — never stored in the
  // job payload so Redis exposure doesn't leak merchant signing keys.
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
    select: { secret: true, active: true },
  });

  if (!endpoint) {
    logger.warn({ endpointId }, '[Webhook] Endpoint no longer exists — dropping job');
    return; // Don't retry; endpoint was deleted
  }
  if (!endpoint.active) {
    logger.info({ endpointId }, '[Webhook] Endpoint deactivated — dropping job');
    return;
  }

  // Re-validate at dispatch time to defeat DNS-rebinding: attacker's domain may have
  // returned a public IP during webhook creation but now resolves to a private IP.
  if (await isPrivateUrl(url)) {
    logger.warn({ endpointId, url }, '[Webhook] URL resolves to private IP at dispatch time — dropping');
    return;
  }

  const attempt = (job.attemptsMade ?? 0) + 1;
  const sig = `sha256=${crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-InvoiceFlow-signature': sig,
        'x-InvoiceFlow-event': event,
      },
      body,
      signal: controller.signal,
    });

    const respText = (await res.text()).slice(0, 2048); // Capture and truncate for DB safety

    if (!res.ok) {
      await prisma.webhookDelivery.create({
        data: { endpointId, event, status: 'failed', responseCode: res.status, responseBody: respText, attempt },
      }).catch(() => {});
      logger.warn({ endpointId, url, status: res.status, event }, '[Webhook] Non-2xx — BullMQ will retry');
      throw new Error(`Non-2xx response: ${res.status}`);
    }

    await prisma.webhookDelivery.create({
      data: { endpointId, event, status: 'success', responseCode: res.status, responseBody: respText, attempt },
    }).catch(() => {});
    logger.info({ endpointId, url, status: res.status, event }, '[Webhook] Delivered');
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      await prisma.webhookDelivery.create({
        data: { endpointId, event, status: 'timeout', responseBody: 'Target URL timed out', attempt },
      }).catch(() => {});
    }
    const reason = err?.name === 'AbortError' ? 'timeout' : err?.message;
    logger.error({ endpointId, url, event, reason }, '[Webhook] Delivery failed — will retry');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

import crypto from 'crypto';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

const DISPATCH_TIMEOUT_MS = 10_000; // 10 s per endpoint

export type OutboundEvent =
  | 'payment.failed'
  | 'payment.retried'
  | 'payment.recovered'
  | 'payment.abandoned';

/**
 * Sends outbound webhook notifications to all active merchant endpoints
 * that have subscribed to the given event type.
 *
 * Delivery is fire-and-forget: errors are logged but never thrown so the
 * calling recovery/webhook flow is never interrupted.
 *
 * Signature header: `x-payrecover-signature: sha256=<hex>`
 * Payload shape:
 *   { event, data: <payment-object>, timestamp: <ISO-string> }
 */
export class OutboundWebhookService {
  static async dispatch(userId: string, event: OutboundEvent, data: object): Promise<void> {
    let endpoints;
    try {
      endpoints = await prisma.webhookEndpoint.findMany({
        where: { userId, active: true, events: { has: event } },
        select: { id: true, url: true, secret: true },
      });
    } catch (err) {
      logger.error({ err, userId, event }, '[Outbound Webhook] DB lookup failed — skipping dispatch');
      return;
    }

    if (!endpoints.length) return;

    const body = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    await Promise.allSettled(
      endpoints.map(ep => OutboundWebhookService.deliver(ep, event, body))
    );
  }

  private static async deliver(
    endpoint: { id: string; url: string; secret: string },
    event: string,
    body: string,
  ): Promise<void> {
    const sig = `sha256=${crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex')}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payrecover-signature': sig,
          'x-payrecover-event': event,
        },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        logger.warn(
          { endpointId: endpoint.id, url: endpoint.url, status: res.status, event },
          '[Outbound Webhook] Non-2xx response'
        );
      } else {
        logger.info(
          { endpointId: endpoint.id, url: endpoint.url, status: res.status, event },
          '[Outbound Webhook] Delivered'
        );
      }
    } catch (err: any) {
      const reason = err?.name === 'AbortError' ? 'timeout' : err?.message;
      logger.error(
        { endpointId: endpoint.id, url: endpoint.url, event, reason },
        '[Outbound Webhook] Delivery failed'
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

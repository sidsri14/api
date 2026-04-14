import { EmailService } from './EmailService.js';
import { SmsService } from './SmsService.js';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

/**
 * Unified Dispatcher for all recovery communications.
 * Handles channel selection logic based on retry stage.
 */
export class NotificationService {
  /**
   * Dispatches recovery messages across multiple channels.
   * Logic:
   * - Attempt 0 (Immediate): Email Only
   * - Attempt 1 (24h): Email Only
   * - Attempt 2 (72h): Email + SMS (for Pro users)
   */
  static async dispatchRecovery(payment: any, trackingUrl: string): Promise<void> {
    const { retryCount, customerEmail, customerPhone, user } = payment;
    
    // Check for potential delivery issues in production
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.SMTP_HOST) logger.warn('[CRITICAL] SMTP_HOST not configured. Email recovery will FAIL.');
      if (user?.plan === 'pro' && !process.env.TWILIO_SID) logger.warn('[CRITICAL] TWILIO_SID not configured. SMS recovery will FAIL for pro users.');
    }

    // Always dispatch Email
    await EmailService.sendRecoveryEmail(payment, trackingUrl, retryCount);
    logger.info({ paymentId: payment.id, retryCount, channel: 'email' }, 'Dispatched Email Recovery');

    // Dispatch SMS + WhatsApp for Pro users on the final attempt (retryCount >= 2)
    if (user?.plan === 'pro' && customerPhone && retryCount >= 2) {
      await SmsService.sendRecoverySms(
        customerPhone,
        payment.customerName || 'there',
        payment.amount,
        payment.currency || 'INR',
        trackingUrl
      );
      logger.info({ paymentId: payment.id, retryCount, channel: 'sms' }, 'Dispatched SMS Recovery');

      // WhatsApp: fires only if TWILIO_WHATSAPP_FROM is configured with whatsapp: prefix
      await SmsService.sendRecoveryWhatsApp(
        customerPhone,
        payment.customerName || 'there',
        payment.amount,
        payment.currency || 'INR',
        trackingUrl
      );
      logger.info({ paymentId: payment.id, retryCount, channel: 'whatsapp' }, 'Dispatched WhatsApp Recovery');
    }
  }
}

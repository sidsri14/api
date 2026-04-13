export interface PaymentEventData {
  providerEventId: string;
  eventType: 'payment.failed' | 'payment.captured' | 'subscription.cancelled' | 'other';
  paymentId: string;
  orderId?: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerPhone?: string;
  customerName?: string;
  status: string;
  rawData: string;
}

export abstract class BaseProvider {
  /**
   * Validates provider credentials (keys/secrets).
   */
  abstract validateCredentials(credentials: any): Promise<boolean>;

  /**
   * Generates a hosted recovery link for a failed payment.
   */
  abstract generateRecoveryLink(failedPayment: any, source: any): Promise<string | null>;

  /**
   * Verifies the webhook signature.
   */
  abstract verifyWebhookSignature(body: any, signature: string, webhookSecret: string): Promise<boolean>;

  /**
   * Parses raw webhook body into a normalized PaymentEventData object.
   */
  abstract parseWebhook(body: any): PaymentEventData | null;
}

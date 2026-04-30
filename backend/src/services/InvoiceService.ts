import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { sendInvoiceEmail } from '../lib/resend.js';
import { StripeBillingService } from './StripeBillingService.js';
import { enqueueInvoiceReminder } from '../jobs/invoice.queue.js';

export class InvoiceService {
  /**
   * Complete flow to create an invoice.
   */
  static async createInvoice(userId: string, data: {
    clientId?: string;
    clientEmail: string;
    description: string;
    amount: number;
    dueDate: Date;
    currency?: string;
  }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Free tier limit enforcement (3 invoices)
    if (user.plan === 'free') {
      const invoiceCount = await prisma.invoice.count({ where: { userId } });
      if (invoiceCount >= 3) {
        throw new Error('You have reached the free tier limit of 3 invoices. Please upgrade to Pro for unlimited invoicing.');
      }
    }

    // 1. Resolve or create client
    let client = null;
    if (data.clientId) {
      client = await prisma.client.findFirst({ where: { id: data.clientId, userId } });
    }
    if (!client) {
      // Upsert an implicit client record keyed by (userId, email) so FK is always satisfied
      client = await prisma.client.upsert({
        where: { userId_email: { userId, email: data.clientEmail } },
        create: { userId, name: data.clientEmail, email: data.clientEmail },
        update: {},
      });
    }

    // 2. Create DB record as DRAFT — promoted to SENT only after Stripe succeeds.
    //    This prevents an orphaned SENT invoice with no payment link if Stripe fails.
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        clientId: client.id,
        number: `INV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        clientEmail: data.clientEmail,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        currency: data.currency || 'USD',
        status: 'DRAFT'
      }
    });

    // 3. PDF served on-demand at /api/invoices/:id/pdf (no upload step yet)
    const pdfUrl = `${process.env.BACKEND_URL ?? 'http://localhost:3000'}/api/invoices/${invoice.id}/pdf`;

    // 4. Create Stripe Payment Link/Session — clean up draft on failure
    let stripeSession: { id: string; checkoutUrl: string | null };
    try {
      stripeSession = await StripeBillingService.createInvoiceSession(invoice, user);
    } catch (stripeErr) {
      await prisma.invoice.delete({ where: { id: invoice.id } }).catch(() => {});
      throw stripeErr;
    }

    // 5. Update invoice: attach Stripe metadata and promote to SENT atomically
    const checkoutUrl = stripeSession.checkoutUrl ?? null;
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfUrl,
        stripeSessionId: stripeSession.id,
        stripeCheckoutUrl: checkoutUrl,
        status: 'SENT',
      }
    });

    // 6. Send Email via Resend
    let brandData: Record<string, string> = {};
    try { brandData = user.brandSettings ? JSON.parse(user.brandSettings) : {}; } catch { /* malformed JSON — use defaults */ }
    await sendInvoiceEmail(data.clientEmail, pdfUrl, checkoutUrl ?? pdfUrl, {
      ...invoice,
      dueDate: data.dueDate
    }, {
      accentColor: brandData.accentColor,
      companyName: brandData.companyName,
      emailTone: user.brandEmailTone || 'professional'
    });

    // 7. Schedule BullMQ reminders — fire-and-forget; Redis unavailability must not
    //    block invoice creation (the invoice is already SENT at this point).
    try {
      await enqueueInvoiceReminder(invoice.id, 'reminder1', 3 * 24 * 60 * 60 * 1000);
      await enqueueInvoiceReminder(invoice.id, 'reminder2', 7 * 24 * 60 * 60 * 1000);
    } catch (queueErr) {
      console.warn('[InvoiceService] Failed to schedule reminders (Redis unavailable?):', queueErr instanceof Error ? queueErr.message : queueErr);
    }

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });

    return {
      success: true,
      ...updatedInvoice,
      paymentUrl: stripeSession.checkoutUrl
    };
  }
}

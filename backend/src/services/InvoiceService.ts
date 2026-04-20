import { prisma } from '../utils/prisma.js';
import { PdfService } from './PdfService.js';
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

    // 1. Resolve client
    let client = null;
    if (data.clientId) {
      client = await prisma.client.findUnique({ where: { id: data.clientId } });
    }

    // 2. Create database record
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        clientId: data.clientId,
        clientEmail: data.clientEmail,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        currency: data.currency || 'USD',
        status: 'pending'
      }
    });

    // 3. Generate PDF (Mock URL for now, or save to some storage like S3/Vercel Blob)
    // For MVP, we might just generate it and send it via email directly as buffer
    const pdfBuffer = await PdfService.generateInvoicePdf(invoice, user, client || { name: data.clientEmail, email: data.clientEmail });
    
    // In a real app, you'd upload this to S3:
    // const pdfUrl = await uploadToS3(pdfBuffer);
    const pdfUrl = `${process.env.BACKEND_URL}/api/invoices/${invoice.id}/pdf`; 

    // 4. Create Stripe Payment Link/Session
    // We'll reuse/extend StripeBillingService or create a new one for one-off payments
    const stripeSession = await StripeBillingService.createInvoiceSession(invoice, user);

    // 5. Update invoice with metadata
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfUrl,
        stripeSessionId: stripeSession.id
      }
    });

    // 6. Send Email via Resend
    await sendInvoiceEmail(data.clientEmail, pdfUrl, stripeSession.url!, {
      ...invoice,
      dueDate: data.dueDate
    });

    // 7. Schedule BullMQ reminders
    // Reminder 1: 3 days before/after? The prompt says "3 * 24 * 60 * 60 * 1000"
    await enqueueInvoiceReminder(invoice.id, 'reminder1', 3 * 24 * 60 * 60 * 1000);
    await enqueueInvoiceReminder(invoice.id, 'reminder2', 7 * 24 * 60 * 60 * 1000);

    return {
      success: true,
      invoiceId: invoice.id,
      paymentUrl: stripeSession.url
    };
  }
}

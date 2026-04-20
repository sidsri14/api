import { prisma } from '../utils/prisma.js';
import { generateInvoicePDF } from './pdf.service.js';
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
        clientId: (data.clientId as string) || '', 
        number: `INV-${Date.now()}`,
        clientEmail: data.clientEmail,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        currency: data.currency || 'USD',
        status: 'SENT'
      }
    });

    // 3. Generate PDF
    const fallbackClient = { id: '', userId, name: data.clientEmail, email: data.clientEmail, phone: null, company: null, createdAt: new Date(), updatedAt: new Date() };
    const pdfBuffer = await generateInvoicePDF({ ...invoice, user, client: client ?? fallbackClient, items: [] } as any);
    
    // In a real app, you'd upload this to S3:
    const pdfUrl = `${process.env.BACKEND_URL}/api/invoices/${invoice.id}/pdf`; 

    // 4. Create Stripe Payment Link/Session
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
    await enqueueInvoiceReminder(invoice.id, 'reminder1', 3 * 24 * 60 * 60 * 1000);
    await enqueueInvoiceReminder(invoice.id, 'reminder2', 7 * 24 * 60 * 60 * 1000);

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });

    return {
      success: true,
      ...updatedInvoice,
      paymentUrl: stripeSession.url
    };
  }
}

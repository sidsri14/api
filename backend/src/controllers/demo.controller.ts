import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { StripeBillingService } from '../services/StripeBillingService.js';
import { generateInvoicePDF } from '../services/pdf.service.js';
import { sendInvoiceEmail } from '../lib/resend.js';
import { enqueueInvoiceReminder } from '../jobs/invoice.queue.js';
import { v4 as uuidv4 } from 'uuid';

export class DemoController {
  static async getInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);

      const invoice = await prisma.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          number: true,
          description: true,
          amount: true,
          currency: true,
          dueDate: true,
          clientEmail: true,
          status: true,
          pdfUrl: true,
          stripeCheckoutUrl: true,
          paidAt: true,
          user: { select: { name: true } },
          client: { select: { name: true, company: true } },
        },
      });

      if (!invoice) return errorResponse(res, 'Invoice not found', 404);

      return successResponse(res, invoice);
    } catch (err) {
      next(err);
    }
  }

  static async payInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);

      const invoice = await prisma.invoice.findUnique({
        where: { id },
        select: { stripeCheckoutUrl: true, status: true },
      });

      if (!invoice) return errorResponse(res, 'Invoice not found', 404);
      if (invoice.status === 'PAID') return errorResponse(res, 'Invoice already paid', 400);
      if (!invoice.stripeCheckoutUrl) return errorResponse(res, 'Payment link unavailable', 503);

      return successResponse(res, { url: invoice.stripeCheckoutUrl });
    } catch (err) {
      next(err);
    }
  }

  static async getInvoicePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { client: true, user: true, items: true },
      });

      if (!invoice) return errorResponse(res, 'Invoice not found', 404);

      const pdf = await generateInvoicePDF(invoice as any);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.number}.pdf"`);
      return res.send(pdf);
    } catch (err) {
      next(err);
    }
  }

  static async createDemoInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, clientEmail, description, dueDate } = req.body;

      if (!amount || !clientEmail || !description || !dueDate) {
        return errorResponse(res, 'All fields are required', 400);
      }

      // 1. Get or create a Demo User
      let user = await prisma.user.findFirst({ where: { email: 'demo@getinvoiceflow.fun' } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: 'demo@getinvoiceflow.fun',
            name: 'InvoiceFlow Demo',
            plan: 'free',
          }
        });
      }

      // 2. Get or create a Demo Client for this email
      let client = await prisma.client.findFirst({ 
        where: { userId: user.id, email: clientEmail } 
      });
      if (!client) {
        client = await prisma.client.create({
          data: {
            userId: user.id,
            email: clientEmail,
            name: clientEmail.split('@')[0],
            company: 'Demo Corporation',
          }
        });
      }

      // 3. Create the Invoice record
      const amountCents = Math.round(parseFloat(amount) * 100);
      const invoice = await prisma.invoice.create({
        data: {
          userId: user.id,
          clientId: client.id,
          number: `DEMO-${Date.now().toString().slice(-6)}`,
          description,
          amount: amountCents,
          currency: 'USD',
          clientEmail,
          dueDate: new Date(dueDate),
          status: 'SENT',
        },
        include: {
          client: true,
          user: true,
          items: true,
        }
      });

      // 4. Generate Stripe Session
      const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const successUrl = `${frontendBase}/demo?id=${invoice.id}&status=paid`;
      const cancelUrl = `${frontendBase}/demo?id=${invoice.id}&status=cancelled`;

      const { checkoutUrl } = await StripeBillingService.createInvoiceSession(
        invoice, 
        user,
        successUrl,
        cancelUrl
      );
      
      // Update invoice with the link
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { stripeCheckoutUrl: checkoutUrl }
      });

      // 5. Generate PDF
      // We need to provide empty items array as it's required by PDF service type
      const invoiceWithItems = { ...invoice, items: [], stripeCheckoutUrl: checkoutUrl };
      const pdfBuffer = await generateInvoicePDF(invoiceWithItems as any);
      
      // 6. Send Email via Resend (fire-and-forget — email failure should not crash the demo)
      const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const pdfUrl = `${frontendBase}/demo?invoice=${invoice.id}&preview=pdf`;
      let emailSent = false;
      try {
        await sendInvoiceEmail(clientEmail, pdfUrl, checkoutUrl!, invoice, {
          companyName: 'InvoiceFlow Demo',
          accentColor: '#10b981',
        });
        emailSent = true;
      } catch (emailErr: any) {
        console.warn('[Demo] Email delivery failed (non-fatal):', emailErr.message);
      }

      // 7. Queue 3-day reminder (fire-and-forget — Redis unavailable should not fail the demo)
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      enqueueInvoiceReminder(invoice.id, 'reminder1', THREE_DAYS_MS).catch((err) => {
        console.warn('[Demo] Failed to enqueue reminder (Redis may be unavailable):', err.message);
      });

      const message = emailSent
        ? `Invoice created! Email sent to ${clientEmail}.`
        : `Invoice created! (Email delivery unavailable — no verified domain yet.)`;

      return successResponse(res, {
        id: invoice.id,
        checkoutUrl,
        message,
      });
    } catch (err) {
      next(err);
    }
  }
}

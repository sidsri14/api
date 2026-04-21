import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { InvoiceService } from '../services/InvoiceService.js';
import { generateInvoicePDF } from '../services/pdf.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'MYR', 'JPY'] as const;

const invoiceCreateSchema = z.object({
  clientId: z.string().optional(),
  clientEmail: z.string().email('Invalid client email').max(254),
  description: z.string().min(1, 'Description is required').max(1000),
  amount: z.coerce.number().int('Amount must be a whole number (cents)').min(1).max(99_999_999),
  dueDate: z.coerce.date().refine(
    d => d >= new Date(new Date().setHours(0, 0, 0, 0)),
    { message: 'Due date cannot be in the past' }
  ),
  currency: z.enum(SUPPORTED_CURRENCIES, { message: 'Unsupported currency' }).default('USD'),
});

export class InvoiceController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = invoiceCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return errorResponse(res, parsed.error.errors[0].message, 400);
      }

      const { clientId, clientEmail, description, amount, dueDate, currency } = parsed.data;

      const result = await InvoiceService.createInvoice(req.userId!, {
        clientId,
        clientEmail,
        description,
        amount,
        dueDate,
        currency
      });

      successResponse(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 10, search, status, clientId, sortKey = 'createdAt', sortDir = 'desc' } = req.query;

      const ALLOWED_SORT_KEYS = ['createdAt', 'updatedAt', 'dueDate', 'amount', 'status'] as const;
      const ALLOWED_SORT_DIRS = ['asc', 'desc'] as const;
      const safeSortKey = ALLOWED_SORT_KEYS.includes(String(sortKey) as any) ? String(sortKey) : 'createdAt';
      const safeSortDir = ALLOWED_SORT_DIRS.includes(String(sortDir) as any) ? (String(sortDir) as 'asc' | 'desc') : 'desc';

      const safePage = Math.max(1, Number(page) || 1);
      const safeTake = Math.min(Math.max(1, Number(limit) || 10), 100);
      const skip = (safePage - 1) * safeTake;
      const take = safeTake;

      const where: any = {
        userId: req.userId!,
        ...(status && { status: String(status) }),
        ...(clientId && { clientId: String(clientId) }),
        ...(search && {
          OR: [
            { clientEmail: { contains: String(search), mode: 'insensitive' } },
            { description: { contains: String(search), mode: 'insensitive' } },
            { client: { name: { contains: String(search), mode: 'insensitive' } } }
          ]
        })
      };

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: { client: true },
          orderBy: { [safeSortKey]: safeSortDir },
          skip,
          take
        }),
        prisma.invoice.count({ where })
      ]);

      successResponse(res, {
        invoices,
        total,
        page: safePage,
        limit: take,
        pages: Math.ceil(total / take)
      });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const userId = String(req.userId);
      const invoice = await prisma.invoice.findFirst({
        where: { id, userId },
        include: { client: true }
      });
      if (!invoice) return errorResponse(res, 'Invoice not found', 404);
      successResponse(res, invoice);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const userId = String(req.userId);
      const count = await prisma.invoice.deleteMany({ where: { id, userId } });
      if (count.count === 0) return errorResponse(res, 'Invoice not found', 404);
      successResponse(res, { success: true });
    } catch (err) {
      next(err);
    }
  }

  static async remind(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const userId = String(req.userId);
      const invoice = await prisma.invoice.findFirst({
        where: { id, userId, status: { notIn: ['PAID', 'CANCELLED'] } },
      });
      if (!invoice) return errorResponse(res, 'Invoice not found or already resolved', 404);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      let brandData: Record<string, string> = {};
      try { brandData = user?.brandSettings ? JSON.parse(user.brandSettings) : {}; } catch { /* use defaults */ }

      const { sendReminderEmail } = await import('../lib/resend.js');
      await sendReminderEmail(invoice.clientEmail, invoice, {
        accentColor: brandData.accentColor,
        companyName: brandData.companyName,
        emailTone: user?.brandEmailTone || 'professional',
      });

      await prisma.invoice.update({
        where: { id },
        data: { remindersSent: { increment: 1 } },
      });

      successResponse(res, { sent: true });
    } catch (err) {
      next(err);
    }
  }

  static async getPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const userId = String(req.userId);
      const invoice = await prisma.invoice.findFirst({
        where: { id, userId },
        include: { client: true, user: true, items: true },
      });
      if (!invoice) return errorResponse(res, 'Invoice not found', 404);
      const pdf = await generateInvoicePDF(invoice as any);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
      return res.send(pdf);
    } catch (err) {
      next(err);
    }
  }
}

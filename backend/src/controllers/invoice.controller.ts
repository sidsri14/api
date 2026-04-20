import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../utils/prisma.js';
import { InvoiceService } from '../services/InvoiceService.js';
import { generateInvoicePDF } from '../services/pdf.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export class InvoiceController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { clientId, clientEmail, description, amount, dueDate, currency } = req.body;
      
      if (!clientEmail || !description || !amount || !dueDate) {
        return errorResponse(res, 'Missing required fields', 400);
      }

      const result = await InvoiceService.createInvoice(req.userId!, {
        clientId,
        clientEmail,
        description,
        amount: parseInt(amount, 10),
        dueDate: new Date(dueDate),
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
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {
        userId: req.userId!,
        ...(status && { status: String(status) }),
        ...(clientId && { clientId: String(clientId) }),
        ...(search && {
          OR: [
            { clientEmail: { contains: String(search) } },
            { description: { contains: String(search) } },
            { client: { name: { contains: String(search) } } }
          ]
        })
      };

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: { client: true },
          orderBy: { [String(sortKey)]: String(sortDir) },
          skip,
          take
        }),
        prisma.invoice.count({ where })
      ]);

      successResponse(res, {
        invoices,
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id, userId: req.userId! },
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
      await prisma.invoice.delete({
        where: { id: req.params.id, userId: req.userId! }
      });
      successResponse(res, { success: true });
    } catch (err) {
      next(err);
    }
  }

  static async getPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id, userId: req.userId! },
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

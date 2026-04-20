import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../utils/prisma.js';
import { InvoiceService } from '../services/InvoiceService.js';
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
      const invoices = await prisma.invoice.findMany({
        where: { userId: req.userId! },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
      });
      successResponse(res, invoices);
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
}

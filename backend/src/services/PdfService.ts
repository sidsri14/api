import { jsPDF } from 'jspdf';
import type { Invoice, Client, User } from '@prisma/client';

export class PdfService {
  /**
   * Generates a sleek, professional PDF buffer for an invoice.
   */
  static async generateInvoicePdf(invoice: Invoice, user: User, client: { name: string; email: string }): Promise<Buffer> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Header - Gradient-like feel (Brand)
    doc.setFillColor(17, 24, 39); // Charcoal
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('StripePay', margin, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Professional Invoicing', margin, 32);

    // Invoice Info
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`INVOICE: ${invoice.number}`, pageWidth - margin - 40, 60, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, pageWidth - margin - 40, 68, { align: 'right' });
    doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, pageWidth - margin - 40, 74, { align: 'right' });

    // Bill To
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', margin, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(client.name, margin, 68);
    doc.text(client.email, margin, 74);

    // From
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', margin, 90);
    doc.setFont('helvetica', 'normal');
    doc.text(user.name || user.email, margin, 98);
    doc.text(user.email, margin, 104);

    // Horizontal Line
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, 115, pageWidth - margin, 115);

    // Table Header
    let y = 130;
    doc.setFont('helvetica', 'bold');
    doc.text('Description', margin, y);
    doc.text('Amount', pageWidth - margin, y, { align: 'right' });

    y += 10;
    // Item
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.description, margin, y);
    doc.text(`$${(invoice.amount / 100).toFixed(2)} ${invoice.currency}`, pageWidth - margin, y, { align: 'right' });

    y += 20;
    doc.line(margin, y, pageWidth - margin, y);

    y += 10;
    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TOTAL:', pageWidth - margin - 60, y);
    doc.text(`$${(invoice.amount / 100).toFixed(2)} ${invoice.currency}`, pageWidth - margin, y, { align: 'right' });

    // Footer
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
    doc.text('Pay online via Stripe for instant confirmation.', pageWidth / 2, footerY + 7, { align: 'center' });

    return Buffer.from(doc.output('arraybuffer'));
  }
}

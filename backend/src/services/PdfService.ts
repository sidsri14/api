import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import fs from 'fs';
import path from 'path';

const fonts = {
  Roboto: {
    normal: path.resolve('public/fonts/Roboto-Regular.ttf'),
    bold: path.resolve('public/fonts/Roboto-Medium.ttf'),
    italics: path.resolve('public/fonts/Roboto-Italic.ttf'),
    bolditalics: path.resolve('public/fonts/Roboto-MediumItalic.ttf')
  }
};

// For now, if fonts aren't available, we'll need to handle that. 
// Standard pdfmake often uses virtual font systems, but in Node we use standard TTF.
// I'll create a fallback or just use standard fonts if possible.
// Actually, I'll use a simpler approach for the initial implementation.

export class PdfService {
  /**
   * Generates a PDF buffer for the invoice.
   */
  static async generateInvoicePdf(invoice: any, user: any, client: any): Promise<Buffer> {
    const printer = new PdfPrinter({
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    });

    const docDefinition: TDocumentDefinitions = {
      content: [
        {
          columns: [
            {
              text: 'StripeFlow',
              style: 'header',
              width: '*'
            },
            {
              stack: [
                { text: 'INVOICE', style: 'invoiceLabel' },
                { text: `#${invoice.id.slice(-8).toUpperCase()}`, style: 'invoiceNumber' }
              ],
              alignment: 'right',
              width: 150
            }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#eee' }], margin: [0, 20] },
        {
          columns: [
            {
              stack: [
                { text: 'FROM:', style: 'subHeader' },
                { text: user.name || user.email, style: 'body' },
                { text: user.email, style: 'bodySmall' },
                { text: user.companyName || '', style: 'bodySmall' }
              ]
            },
            {
              stack: [
                { text: 'BILL TO:', style: 'subHeader' },
                { text: client.name, style: 'body' },
                { text: client.email, style: 'bodySmall' },
                { text: client.company || '', style: 'bodySmall' }
              ],
              alignment: 'right'
            }
          ]
        },
        { margin: [0, 40], table: {
          widths: ['*', 100, 100],
          body: [
            [
              { text: 'Description', style: 'tableHeader' },
              { text: 'Quantity', style: 'tableHeader', alignment: 'center' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ],
            [
              { text: invoice.description, style: 'tableBody' },
              { text: '1', style: 'tableBody', alignment: 'center' },
              { text: `$${(invoice.amount / 100).toFixed(2)}`, style: 'tableBody', alignment: 'right' }
            ]
          ]
        }, layout: 'lightHorizontalLines' },
        {
          columns: [
            { text: '', width: '*' },
            {
              stack: [
                {
                  columns: [
                    { text: 'Total Amount Due:', bold: true },
                    { text: `$${(invoice.amount / 100).toFixed(2)}`, alignment: 'right', bold: true }
                  ]
                },
                { text: `Due by: ${new Date(invoice.dueDate).toDateString()}`, margin: [0, 10], color: '#666', fontSize: 10 }
              ],
              width: 200
            }
          ]
        },
        {
          text: 'Payment Instructions',
          style: 'subHeader',
          margin: [0, 40, 0, 10]
        },
        {
          text: 'Please use the link sent to your email or scan the QR code to complete the payment via Stripe.',
          style: 'bodySmall'
        }
      ],
      styles: {
        header: { fontSize: 24, bold: true, color: '#000' },
        invoiceLabel: { fontSize: 10, color: '#666', margin: [0, 0, 0, 2] },
        invoiceNumber: { fontSize: 14, bold: true },
        subHeader: { fontSize: 10, bold: true, color: '#666', margin: [0, 0, 0, 5], textTransform: 'uppercase' },
        body: { fontSize: 12, margin: [0, 0, 0, 2] },
        bodySmall: { fontSize: 10, color: '#666' },
        tableHeader: { fontSize: 10, bold: true, color: '#666', margin: [0, 5] },
        tableBody: { fontSize: 11, margin: [0, 8] }
      },
      defaultStyle: {
        font: 'Roboto'
      }
    };

    return new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: any[] = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err) => reject(err));
      pdfDoc.end();
    });
  }
}

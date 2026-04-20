import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY === 'mock' ? 're_123' : process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

const IS_MOCK = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'mock';

export async function sendInvoiceEmail(to: string, pdfUrl: string, paymentUrl: string, invoice: any) {
  const amount = (invoice.amount / 100).toFixed(2);
  
  if (IS_MOCK) {
    console.log(`[MOCK EMAIL] To: ${to}, Subject: Invoice: ${invoice.description}, PDF: ${pdfUrl}, Pay: ${paymentUrl}`);
    return { id: 'mock_email_id' };
  }

  if (!resend) throw new Error('Resend Not Initialized');

  const { data, error } = await resend.emails.send({
    from: 'StripeFlow <invoices@yourdomain.com>', 
    to,
    subject: `Invoice: ${invoice.description} - ${amount} ${invoice.currency || 'USD'}`,
    html: `
      <!-- ... html content ... -->
    `,
  });

  if (error) {
    console.error('[Resend Error]', error);
    throw error;
  }
  return data;
}

export async function sendReminderEmail(to: string, invoice: any) {
  const amount = (invoice.amount / 100).toFixed(2);
  
  if (IS_MOCK) {
    console.log(`[MOCK EMAIL] To: ${to}, Subject: Reminder: ${invoice.description} is overdue`);
    return { id: 'mock_reminder_id' };
  }

  if (!resend) throw new Error('Resend Not Initialized');

  const { data, error } = await resend.emails.send({
    from: 'StripeFlow <reminders@yourdomain.com>',
    to,
    subject: `Reminder: Invoice for ${invoice.description} is overdue`,
    html: `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Payment Reminder</h2>
        <p>This is a friendly reminder that your payment for <strong>${invoice.description}</strong> is now overdue.</p>
        <p><strong>Amount:</strong> ${amount} ${invoice.currency || 'USD'}</p>
        <p>Please complete the payment as soon as possible to avoid any service interruption.</p>
        <a href="${process.env.FRONTEND_URL}/invoice/${invoice.id}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View & Pay Invoice</a>
      </div>
    `,
  });
  if (error) throw error;
  return data;
}

export async function sendReceiptEmail(to: string, invoice: any) {
  const amount = (invoice.amount / 100).toFixed(2);
  
  if (IS_MOCK) {
    console.log(`[MOCK EMAIL] To: ${to}, Subject: Payment received - Thank you!`);
    return { id: 'mock_receipt_id' };
  }

  if (!resend) throw new Error('Resend Not Initialized');

  const { data, error } = await resend.emails.send({
    from: 'StripeFlow <receipts@yourdomain.com>',
    to,
    subject: `Payment received - Thank you!`,
    html: `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Payment Received</h2>
        <p>Thank you for your payment!</p>
        <p>Invoice <strong>#${invoice.id.slice(-8)}</strong> for <strong>${amount} ${invoice.currency || 'USD'}</strong> has been successfully paid.</p>
        <p>You can download your receipt from your dashboard.</p>
      </div>
    `,
  });
  if (error) throw error;
  return data;
}

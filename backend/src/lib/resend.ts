import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendInvoiceEmail(to: string, pdfUrl: string, paymentUrl: string, invoice: any) {
  const amount = (invoice.amount / 100).toFixed(2);
  const { data, error } = await resend.emails.send({
    from: 'StripeFlow <invoices@yourdomain.com>', // verify domain at resend.com
    to,
    subject: `Invoice: ${invoice.description} - ${amount} ${invoice.currency || 'USD'}`,
    html: `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h1 style="color: #000;">New Invoice from StripeFlow</h1>
        <p>Hello,</p>
        <p>You have received a new invoice for <strong>${invoice.description}</strong>.</p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">Amount Due</p>
          <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #000;">${amount} ${invoice.currency || 'USD'}</p>
          <p style="margin: 15px 0 0; font-size: 14px; color: #666;">Due Date</p>
          <p style="margin: 5px 0 0; font-size: 16px; color: #000;">${new Date(invoice.dueDate).toDateString()}</p>
        </div>
        <a href="${paymentUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-bottom: 20px;">Pay Online Now</a>
        <p style="font-size: 14px; color: #666;">
          You can also view the attached PDF or <a href="${pdfUrl}" target="_blank">download it here</a>.
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">
          Powered by StripeFlow — The premium invoicing tool for freelancers.
        </p>
      </div>
    `,
    // attachments: [{ filename: `invoice-${invoice.id}.pdf`, path: pdfUrl }] // Requires binary or public URL
  });

  if (error) {
    console.error('[Resend Error]', error);
    throw error;
  }
  return data;
}

export async function sendReminderEmail(to: string, invoice: any) {
  const amount = (invoice.amount / 100).toFixed(2);
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

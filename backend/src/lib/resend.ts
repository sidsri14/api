import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY === 'mock' ? 're_123' : process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

const IS_MOCK = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'mock';

interface BrandingContext {
  accentColor?: string;
  emailTone?: string;
  companyName?: string;
}

/**
 * Modern, branded HTML template wrapper
 */
function getEmailTemplate(content: string, branding: BrandingContext) {
  const accent = branding.accentColor || '#10b981'; // Default emerald-500
  return `
    <div style="font-family: 'Inter', -apple-system, sans-serif; background: #f9fafb; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background: ${accent}; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">
            ${branding.companyName || 'StripePay'}
          </h1>
        </div>
        <div style="padding: 40px; color: #1f2937; line-height: 1.6;">
          ${content}
        </div>
        <div style="padding: 24px; background: #f3f4f6; text-align: center; color: #6b7280; font-size: 12px;">
          &copy; ${new Date().getFullYear()} ${branding.companyName || 'StripePay'}. All rights reserved.
        </div>
      </div>
    </div>
  `;
}

export async function sendInvoiceEmail(to: string, pdfUrl: string, paymentUrl: string, invoice: any, branding: BrandingContext = {}) {
  const amount = (invoice.amount / 100).toFixed(2);
  const accent = branding.accentColor || '#10b981';
  
  const content = `
    <h2 style="margin-top: 0;">New Invoice Available</h2>
    <p>A new invoice has been generated for <strong>${invoice.description}</strong>.</p>
    <div style="margin: 32px 0; padding: 24px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="margin-bottom: 8px; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Amount Due</div>
      <div style="font-size: 32px; font-weight: 800; color: #111827;">${amount} ${invoice.currency || 'USD'}</div>
      <div style="margin-top: 16px; color: #6b7280; font-size: 14px;">Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</div>
    </div>
    <a href="${paymentUrl}" style="display: block; width: 100%; box-sizing: border-box; background: ${accent}; color: #ffffff; padding: 16px; text-align: center; border-radius: 12px; font-weight: 800; text-decoration: none; margin-bottom: 12px;">Pay Invoice Securely</a>
    <p style="text-align: center;"><a href="${pdfUrl}" style="color: #6b7280; text-decoration: underline; font-size: 14px;">Download PDF Receipt</a></p>
  `;

  if (IS_MOCK) {
    console.log(`[MOCK EMAIL] To: ${to}, Branding: ${JSON.stringify(branding)}`);
    return { id: 'mock_email_id' };
  }

  if (!resend) throw new Error('Resend Not Initialized');
  const { data, error } = await resend.emails.send({
    from: `${branding.companyName || 'StripePay'} <onboarding@resend.dev>`,
    to,
    subject: `Invoice: ${invoice.description} - ${amount} ${invoice.currency || 'USD'}`,
    html: getEmailTemplate(content, branding)
  });

  if (error) throw error;
  return data;
}

export async function sendReminderEmail(to: string, invoice: any, branding: BrandingContext = {}) {
  const amount = (invoice.amount / 100).toFixed(2);
  const accent = branding.accentColor || '#10b981';
  const tone = branding.emailTone || 'professional';

  let header = 'Payment Reminder';
  let message = `This is a friendly reminder that your payment for <strong>${invoice.description}</strong> is now overdue.`;
  
  if (tone === 'friendly') {
    header = 'Quick Check-in';
    message = `Hi there! Just a quick note to let you know that the invoice for <strong>${invoice.description}</strong> is still waiting for you. We'd appreciate it if you could take a moment to settle it!`;
  } else if (tone === 'urgent') {
    header = 'URGENT: Payment Overdue';
    message = `Action Required: Your payment for <strong>${invoice.description}</strong> is significantly overdue. Please complete the payment immediately to avoid service interruption.`;
  }

  const content = `
    <h2 style="margin-top: 0;">${header}</h2>
    <p>${message}</p>
    <div style="margin: 32px 0; padding: 24px; background: #fff1f2; border-radius: 12px; border: 1px solid #fecaca;">
      <div style="margin-bottom: 8px; color: #b91c1c; font-size: 14px; font-weight: 600; text-transform: uppercase;">Amount Outstanding</div>
      <div style="font-size: 32px; font-weight: 800; color: #991b1b;">${amount} ${invoice.currency || 'USD'}</div>
    </div>
    <a href="${process.env.FRONTEND_URL}/invoice/${invoice.id}" style="display: block; width: 100%; box-sizing: border-box; background: ${accent}; color: #ffffff; padding: 16px; text-align: center; border-radius: 12px; font-weight: 800; text-decoration: none;">View & Pay Now</a>
  `;

  if (IS_MOCK) {
    console.log(`[MOCK EMAIL] To: ${to}, Tone: ${tone}, Branding: ${JSON.stringify(branding)}`);
    return { id: 'mock_reminder_id' };
  }

  if (!resend) throw new Error('Resend Not Initialized');
  const { data, error } = await resend.emails.send({
    from: `${branding.companyName || 'StripePay'} <reminders@yourdomain.com>`,
    to,
    subject: `${tone === 'urgent' ? 'URGENT: ' : ''}Payment Reminder for ${invoice.description}`,
    html: getEmailTemplate(content, branding)
  });

  if (error) throw error;
  return data;
}

export async function sendReceiptEmail(to: string, invoice: any, branding: BrandingContext = {}) {
  const amount = (invoice.amount / 100).toFixed(2);
  const accent = branding.accentColor || '#10b981';
  
  const content = `
    <h2 style="margin-top: 0;">Payment Received</h2>
    <p>Thank you for your payment! Your transaction for <strong>${invoice.description}</strong> was successful.</p>
    <div style="margin: 32px 0; padding: 24px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
      <div style="margin-bottom: 8px; color: #15803d; font-size: 14px; font-weight: 600; text-transform: uppercase;">Paid Amount</div>
      <div style="font-size: 32px; font-weight: 800; color: #166534;">${amount} ${invoice.currency || 'USD'}</div>
    </div>
    <p style="color: #6b7280; font-size: 14px;">Invoice ID: #${invoice.id.slice(-8).toUpperCase()}</p>
  `;

  if (IS_MOCK) {
    console.log(`[MOCK RECEIPT] To: ${to}`);
    return { id: 'mock_receipt_id' };
  }

  if (!resend) throw new Error('Resend Not Initialized');
  const { data, error } = await resend.emails.send({
    from: `${branding.companyName || 'StripePay'} <receipts@yourdomain.com>`,
    to,
    subject: `Payment received - Thank you!`,
    html: getEmailTemplate(content, branding)
  });

  if (error) throw error;
  return data;
}

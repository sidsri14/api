import { sendEmail } from '../services/resend.service.js';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Strips characters that can break RFC 2822 email headers (newlines, angle brackets, quotes).
function sanitizeHeaderValue(s: unknown): string {
  return String(s ?? '').replace(/[\r\n"<>]/g, '').slice(0, 100);
}

interface BrandingContext {
  accentColor?: string;
  emailTone?: string;
  companyName?: string;
}

function getEmailTemplate(content: string, branding: BrandingContext) {
  // accentColor is validated to be a hex color (#rrggbb) before being stored,
  // so it is safe to interpolate directly. All other user-supplied fields use esc().
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.accentColor || '') ? branding.accentColor! : '#10b981';
  const company = esc(branding.companyName || 'InvoiceFlow');
  return `
    <div style="font-family: 'Inter', -apple-system, sans-serif; background: #f9fafb; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background: ${accent}; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">
            ${company}
          </h1>
        </div>
        <div style="padding: 40px; color: #1f2937; line-height: 1.6;">
          ${content}
        </div>
        <div style="padding: 24px; background: #f3f4f6; text-align: center; color: #6b7280; font-size: 12px;">
          &copy; ${new Date().getFullYear()} ${company}. All rights reserved.
        </div>
      </div>
    </div>
  `;
}

export async function sendInvoiceEmail(to: string, pdfUrl: string, paymentUrl: string, invoice: any, branding: BrandingContext = {}) {
  const amount = (invoice.amount / 100).toFixed(2);
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.accentColor || '') ? branding.accentColor! : '#10b981';

  const content = `
    <h2 style="margin-top: 0;">New Invoice Available</h2>
    <p>A new invoice has been generated for <strong>${esc(invoice.description)}</strong>.</p>
    <div style="margin: 32px 0; padding: 24px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="margin-bottom: 8px; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Amount Due</div>
      <div style="font-size: 32px; font-weight: 800; color: #111827;">${esc(amount)} ${esc(invoice.currency || 'USD')}</div>
      <div style="margin-top: 16px; color: #6b7280; font-size: 14px;">Due Date: ${esc(new Date(invoice.dueDate).toLocaleDateString())}</div>
    </div>
    <a href="${esc(paymentUrl)}" style="display: block; width: 100%; box-sizing: border-box; background: ${accent}; color: #ffffff; padding: 16px; text-align: center; border-radius: 12px; font-weight: 800; text-decoration: none; margin-bottom: 12px;">Pay Invoice Securely</a>
    <p style="text-align: center;"><a href="${esc(pdfUrl)}" style="color: #6b7280; text-decoration: underline; font-size: 14px;">Download PDF Receipt</a></p>
  `;

  const safeName = sanitizeHeaderValue(branding.companyName || 'InvoiceFlow');
  const fromAddress = process.env.RESEND_FROM ?? 'noreply@getinvoiceflow.fun';
  await sendEmail({
    to,
    subject: `Invoice: ${sanitizeHeaderValue(invoice.description)} - ${amount} ${invoice.currency || 'USD'}`,
    html: getEmailTemplate(content, branding),
    from: `${safeName} <${fromAddress}>`,
  });
}

export async function sendReminderEmail(to: string, invoice: any, branding: BrandingContext = {}) {
  const amount = (invoice.amount / 100).toFixed(2);
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.accentColor || '') ? branding.accentColor! : '#10b981';
  const tone = branding.emailTone || 'professional';

  const descEscaped = esc(invoice.description);
  let header = 'Payment Reminder';
  let message = `This is a friendly reminder that your payment for <strong>${descEscaped}</strong> is now overdue.`;

  if (tone === 'friendly') {
    header = 'Quick Check-in';
    message = `Hi there! Just a quick note to let you know that the invoice for <strong>${descEscaped}</strong> is still waiting for you. We'd appreciate it if you could take a moment to settle it!`;
  } else if (tone === 'urgent') {
    header = 'URGENT: Payment Overdue';
    message = `Action Required: Your payment for <strong>${descEscaped}</strong> is significantly overdue. Please complete the payment immediately to avoid service interruption.`;
  }

  const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  // Prefer the Stripe checkout URL so clients can pay without logging in.
  // Fall back to the invoice detail page only if no payment link is available.
  const paymentLink = invoice.stripeCheckoutUrl || `${frontendBase}/invoices/${invoice.id}`;
  const content = `
    <h2 style="margin-top: 0;">${esc(header)}</h2>
    <p>${message}</p>
    <div style="margin: 32px 0; padding: 24px; background: #fff1f2; border-radius: 12px; border: 1px solid #fecaca;">
      <div style="margin-bottom: 8px; color: #b91c1c; font-size: 14px; font-weight: 600; text-transform: uppercase;">Amount Outstanding</div>
      <div style="font-size: 32px; font-weight: 800; color: #991b1b;">${esc(amount)} ${esc(invoice.currency || 'USD')}</div>
    </div>
    <a href="${esc(paymentLink)}" style="display: block; width: 100%; box-sizing: border-box; background: ${accent}; color: #ffffff; padding: 16px; text-align: center; border-radius: 12px; font-weight: 800; text-decoration: none;">View &amp; Pay Now</a>
  `;

  const safeName = sanitizeHeaderValue(branding.companyName || 'InvoiceFlow');
  const fromAddress = process.env.RESEND_FROM ?? 'noreply@getinvoiceflow.fun';
  await sendEmail({
    to,
    subject: `${tone === 'urgent' ? 'URGENT: ' : ''}Payment Reminder for ${sanitizeHeaderValue(invoice.description)}`,
    html: getEmailTemplate(content, branding),
    from: `${safeName} <${fromAddress}>`,
  });
}

export async function sendReceiptEmail(to: string, invoice: any, branding: BrandingContext = {}) {
  const amount = (invoice.amount / 100).toFixed(2);
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.accentColor || '') ? branding.accentColor! : '#10b981';

  const content = `
    <h2 style="margin-top: 0;">Payment Received</h2>
    <p>Thank you for your payment! Your transaction for <strong>${esc(invoice.description)}</strong> was successful.</p>
    <div style="margin: 32px 0; padding: 24px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
      <div style="margin-bottom: 8px; color: #15803d; font-size: 14px; font-weight: 600; text-transform: uppercase;">Paid Amount</div>
      <div style="font-size: 32px; font-weight: 800; color: #166534;">${esc(amount)} ${esc(invoice.currency || 'USD')}</div>
    </div>
    <p style="color: #6b7280; font-size: 14px;">Invoice ID: #${esc(invoice.id.slice(-8).toUpperCase())}</p>
  `;

  const safeName = sanitizeHeaderValue(branding.companyName || 'InvoiceFlow');
  const fromAddress = process.env.RESEND_FROM ?? 'noreply@getinvoiceflow.fun';
  await sendEmail({
    to,
    subject: `Payment received - Thank you!`,
    html: getEmailTemplate(content, branding),
    from: `${safeName} <${fromAddress}>`,
  });
}

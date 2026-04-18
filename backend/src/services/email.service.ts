import nodemailer from 'nodemailer';

// ── Transport ─────────────────────────────────────────────────────────────────
// Configure via env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// For development without SMTP configured, emails are logged to the console
// so you can verify the content without needing a mail server.
// For production, set all SMTP_* vars.

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // Dev/preview mode — returns null to trigger console fallback
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// Cached at module load — one connection pool for the process lifetime
const transport = createTransport();

const FROM_ADDRESS = process.env.SMTP_FROM || 'PayRecover <noreply@payrecover.app>';

async function sendMail(to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!transport) {
    // No SMTP configured — print to console so dev can see the content
    console.log('\n══════════════════════════════════════════════════');
    console.log(`📧 [DEV EMAIL — not sent, configure SMTP_* env vars to send]`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('──────────────────────────────────────────────────');
    console.log(text);
    if (html) {
      console.log('────────────────── [HTML Content] ────────────────');
      console.log('(HTML content suppressed for brevity in console)');
    }
    console.log('══════════════════════════════════════════════════\n');
    return;
  }

  await transport.sendMail({
    from: FROM_ADDRESS,
    to,
    subject,
    text,
    html,
  });
}

// ── Email Layout ─────────────────────────────────────────────────────────────
interface BrandingOptions {
  logoUrl?: string;
  primaryColor?: string;
  signature?: string;
  emailSubject?: string;
  emailTone?: 'professional' | 'friendly' | 'urgent';
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const safeColor = (c?: string) => /^#[0-9a-fA-F]{6}$/.test(c || '') ? c! : '#10b981';
const safeHttpsUrl = (u?: string) => { try { const p = new URL(u || ''); return p.protocol === 'https:' ? u! : null; } catch { return null; } };

const getBaseLayout = (content: string, ctaLink?: string, ctaText?: string, branding?: BrandingOptions) => {
  const primaryColor = safeColor(branding?.primaryColor);
  const logoUrl = safeHttpsUrl(branding?.logoUrl);
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="height: 40px; width: auto; display: block; margin-bottom: 20px;" />`
    : `<span style="font-size: 24px; font-weight: 800; color: ${primaryColor}; letter-spacing: -0.5px;">PayRecover</span>`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8f8f8; padding: 40px 20px; color: #1a1a1a;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="padding: 40px;">
          <div style="margin-bottom: 30px;">
            ${logo}
          </div>
          <div style="font-size: 16px; line-height: 1.6; color: #4b5563;">
            ${content}
          </div>
          ${ctaLink ? `
            <div style="margin-top: 32px;">
              <a href="${ctaLink}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; padding: 16px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.2);">
                ${ctaText || 'Complete Payment'}
              </a>
            </div>
          ` : ''}
          ${branding?.signature ? `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 14px; color: #9ca3af;">${escapeHtml(branding.signature)}</div>` : ''}
        </div>
        <div style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">Powered by PayRecover · Automated Failed Payment Recovery</p>
        </div>
      </div>
    </div>
  `;
};

import { formatCurrency } from '../utils/currency.js';

// ── Email 1: Immediate notification (retryCount = 0) ─────────────────────────

export const sendPaymentFailedEmail = async (
  to: string,
  params: {
    customerName?: string;
    amount: number;
    currency: string;
    paymentLink: string;
    paymentId: string;
  },
  branding?: BrandingOptions
): Promise<void> => {
  const name = params.customerName ? params.customerName.split(' ')[0] : null;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const amt = formatCurrency(params.amount, params.currency);

  const subject = branding?.emailSubject 
    ? branding.emailSubject.replace('{{amount}}', amt)
    : branding?.emailTone === 'urgent'
      ? `Action Required: Your ${amt} payment failed`
      : branding?.emailTone === 'friendly'
        ? `Just a heads-up: Your ${amt} payment didn't go through`
        : `Your ${amt} payment didn't go through — complete it here`;

  let bodyHtml = `<p>Your payment of <strong>${amt}</strong> couldn't be processed, but we've saved your order details.</p>`;
  if (branding?.emailTone === 'urgent') {
    bodyHtml = `<p><strong>Immediate action required:</strong> Your payment of <strong>${amt}</strong> failed. To avoid cancellation/interruption, please complete your payment using the link below.</p>`;
  } else if (branding?.emailTone === 'friendly') {
    bodyHtml = `<p>Hey! We noticed your <strong>${amt}</strong> payment didn't quite make it. Don't worry — we've saved your spot. You can finish up below whenever you're ready!</p>`;
  }

  const text = `${greeting}\n\nYour payment of ${amt} couldn't be processed — but your order is still saved.\n\nComplete it now in under 10 seconds:\n${params.paymentLink}\n\nThis link is valid for 7 days. If you need help, just reply to this email.\n\nRef: ${params.paymentId}\n\n──────────────────────────────────────────────────\nPowered by PayRecover · Automated payment recovery`;

  const html = getBaseLayout(
    `${bodyHtml}
     <p>You can complete your payment now in under 10 seconds using the link below. This link is valid for 7 days.</p>`,
    params.paymentLink,
    'Complete Payment Now',
    branding
  );

  await sendMail(to, subject, text, html);
};

// ── Email 2+: Follow-up reminders (retryCount = 1, 2) ────────────────────────

export const sendPaymentReminderEmail = async (
  to: string,
  params: {
    customerName?: string;
    amount: number;
    currency: string;
    paymentLink: string;
    dayOffset: number;
    paymentId: string;
  },
  branding?: BrandingOptions
): Promise<void> => {
  const name = params.customerName ? params.customerName.split(' ')[0] : null;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const amt = formatCurrency(params.amount, params.currency);
  const isFinal = params.dayOffset >= 3;

  const subject = isFinal
    ? `Last chance — your ${amt} payment link expires soon`
    : `Quick reminder — your ${amt} payment is still waiting`;

  const body = isFinal
    ? `${greeting}

This is your final reminder about your ${amt} payment.

Your payment link expires in a few days — after that it's gone.
Complete it now:
→ ${params.paymentLink}

Takes less than 10 seconds.`
    : `${greeting}

Just a quick nudge — your ${amt} payment is still pending.

Pick up where you left off:
→ ${params.paymentLink}

Your spot is still saved. Takes less than a minute.`;

  const text = `${body}\n\nLink: ${params.paymentLink}\n\nRef: ${params.paymentId}\n\n──────────────────────────────────────────────────\nPowered by PayRecover · Automated payment recovery`;

  const html = getBaseLayout(
    `<p>${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
    params.paymentLink,
    isFinal ? 'Final Chance: Pay Now' : 'Complete Payment',
    branding
  );

  await sendMail(to, subject, text, html);
};

// ── Email 3: Password reset ───────────────────────────────────────────────────

export const sendPasswordResetEmail = async (
  to: string,
  params: { resetLink: string; expiresInMinutes: number }
): Promise<void> => {
  const subject = 'Reset your PayRecover password';
  const text = `Hi,

You requested a password reset for your PayRecover account.

Reset your password here (expires in ${params.expiresInMinutes} minutes):
→ ${params.resetLink}

If you didn't request this, you can safely ignore this email.

──────────────────────────────────────────────────
Powered by PayRecover`;

  await sendMail(to, subject, text);
};

// ── Email 4: Email verification ───────────────────────────────────────────────

export const sendEmailVerificationEmail = async (
  to: string,
  params: { verifyLink: string }
): Promise<void> => {
  const subject = 'Verify your PayRecover email address';
  const text = `Hi,

Please verify your email address to activate your PayRecover account.

Click here to verify:
→ ${params.verifyLink}

This link expires in 24 hours.

──────────────────────────────────────────────────
Powered by PayRecover`;

  await sendMail(to, subject, text);
};

// ── Email 5: Contact form submission ─────────────────────────────────────────

export const sendContactEmail = async (params: {
  name: string;
  email: string;
  message: string;
}): Promise<void> => {
  const to = process.env.SUPPORT_EMAIL;
  if (!to) {
    console.log('\n══════════════════════════════════════════════════');
    console.log(`📧 [CONTACT FORM — SUPPORT_EMAIL not set, message not sent]`);
    console.log(`From: ${params.name} <${params.email}>`);
    console.log('──────────────────────────────────────────────────');
    console.log(params.message);
    console.log('══════════════════════════════════════════════════\n');
    return;
  }

  const subject = `[PayRecover Contact] Message from ${params.name}`;
  const text = `Name: ${params.name}\nEmail: ${params.email}\n\nMessage:\n${params.message}`;

  await sendMail(to, subject, text);
};

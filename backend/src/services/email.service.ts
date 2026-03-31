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

const FROM_ADDRESS = process.env.SMTP_FROM || 'PayRecover <noreply@payrecover.app>';

async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const transport = createTransport();

  if (!transport) {
    // No SMTP configured — print to console so dev can see the content
    console.log('\n══════════════════════════════════════════════════');
    console.log(`📧 [DEV EMAIL — not sent, configure SMTP_* env vars to send]`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('──────────────────────────────────────────────────');
    console.log(text);
    console.log('══════════════════════════════════════════════════\n');
    return;
  }

  await transport.sendMail({
    from: FROM_ADDRESS,
    to,
    subject,
    text,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatAmount = (paise: number, currency: string): string => {
  const symbol = currency === 'INR' ? '₹' : currency + ' ';
  return `${symbol}${(paise / 100).toLocaleString('en-IN')}`;
};

// ── Email 1: Immediate notification (retryCount = 0) ─────────────────────────

export const sendPaymentFailedEmail = async (
  to: string,
  params: {
    customerName?: string;
    amount: number;
    currency: string;
    paymentLink: string;
    paymentId: string;
  }
): Promise<void> => {
  const name = params.customerName ? params.customerName.split(' ')[0] : null;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const amt = formatAmount(params.amount, params.currency);

  const subject = `Your ${amt} payment didn't go through — complete it here`;

  const text = `${greeting}

Your payment of ${amt} couldn't be processed — but your order is still saved.

Complete it now in under 10 seconds:
→ ${params.paymentLink}

This link is valid for 7 days. If you need help, just reply to this email.

Ref: ${params.paymentId}

──────────────────────────────────────────────────
Powered by PayRecover · Automated payment recovery`;

  await sendMail(to, subject, text);
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
  }
): Promise<void> => {
  const name = params.customerName ? params.customerName.split(' ')[0] : null;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const amt = formatAmount(params.amount, params.currency);
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

  const text = `${body}

Ref: ${params.paymentId}

──────────────────────────────────────────────────
Powered by PayRecover · Automated payment recovery`;

  await sendMail(to, subject, text);
};

// ── Email 3: Password reset ───────────────────────────────────────────────────
// TODO: Implement when password reset endpoint is added (#14)

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
// TODO: Implement when email verification is added (#15)

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

import { sendEmail } from './resend.service.js';

const APP_NAME = 'InvoiceFlow';

export async function sendEmailVerificationEmail(
  email: string,
  { verifyLink }: { verifyLink: string }
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Verify your ${APP_NAME} account`,
    html: `
      <h2>Welcome to ${APP_NAME}!</h2>
      <p>Click the link below to verify your email address. This link expires in 24 hours.</p>
      <p><a href="${verifyLink}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">Verify Email</a></p>
      <p>Or copy: ${verifyLink}</p>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  { resetLink, expiresInMinutes }: { resetLink: string; expiresInMinutes: number }
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html: `
      <h2>Password Reset</h2>
      <p>Click below to set a new password. This link expires in ${expiresInMinutes} minutes.</p>
      <p><a href="${resetLink}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">Reset Password</a></p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
}

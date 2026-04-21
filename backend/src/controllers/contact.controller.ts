import type { Request, Response, NextFunction } from 'express';
import { sendEmail } from '../services/resend.service.js';
import { successResponse } from '../utils/apiResponse.js';

// HTML-escape only for HTML body content — never for plain-text fields like subjects
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

export const submitContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, message } = req.body as { name: string; email: string; message: string };
    const to = process.env.SUPPORT_EMAIL;
    if (to) {
      await sendEmail({
        to,
        // Subject is plain text — do NOT HTML-escape it (produces literal &amp; etc. in inbox)
        subject: `[StripeFlow Contact] Message from ${name}`,
        html: `<p><strong>Name:</strong> ${esc(name)}</p><p><strong>Email:</strong> ${esc(email)}</p><p><strong>Message:</strong><br/>${esc(message).replace(/\n/g, '<br/>')}</p>`,
      });
    } else {
      console.log(`[Contact] From: ${name} <${email}>\n${message}`);
    }
    successResponse(res, { success: true });
  } catch (err) {
    next(err);
  }
};

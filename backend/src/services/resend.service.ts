import { Resend } from 'resend';

let client: Resend | null = null;
let clientKey: string | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY ?? null;
  if (!key) return null;
  if (!client || clientKey !== key) {
    client = new Resend(key);
    clientKey = key;
  }
  return client;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const resend = getClient();
  if (!resend) {
    console.log('\n══════════════════════════════════════════════════');
    console.log('[DEV EMAIL — no RESEND_API_KEY — not sent]');
    console.log(`To: ${params.to} | Subject: ${params.subject}`);
    console.log('══════════════════════════════════════════════════\n');
    return;
  }

  const { error } = await resend.emails.send({
    from: params.from ?? process.env.RESEND_FROM ?? 'InvoiceFlow <noreply@InvoiceFlow.app>',
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

import { prisma } from '../utils/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.utils.js';
import { validateRazorpayCredentials } from './razorpay.service.js';

export const getWebhookUrl = (provider: string, sourceId: string) => {
  const base = (process.env.WEBHOOK_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/api/webhooks/${provider.toLowerCase()}/${sourceId}`;
};

export const createPaymentSource = (userId: string, data: any) => {
  const { provider, name, credentials, webhookSecret } = data;
  return prisma.paymentSource.create({
    data: {
      userId,
      provider: provider.toLowerCase(),
      name,
      credentials: encrypt(JSON.stringify(credentials)),
      webhookSecret: encrypt(webhookSecret),
    },
    select: { id: true, userId: true, provider: true, name: true, createdAt: true },
  });
};

export const getPaymentSources = async (userId: string) => {
  const srcs = await prisma.paymentSource.findMany({
    where: { userId },
    select: { id: true, userId: true, provider: true, name: true, createdAt: true, _count: { select: { events: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return srcs.map(s => ({ ...s, webhookUrl: getWebhookUrl(s.provider, s.id) }));
};

export const deletePaymentSource = async (userId: string, id: string) => {
  const s = await prisma.paymentSource.findFirst({ where: { id, userId } });
  if (!s) throw { status: 404, message: 'Source not found' };
  await prisma.paymentSource.delete({ where: { id } });
};

export const getSourceWithSecrets = async (id: string) => {
  const s = await prisma.paymentSource.findUnique({ where: { id } });
  if (!s) return null;
  return {
    ...s,
    credentials: JSON.parse(decrypt(s.credentials)),
    webhookSecret: decrypt(s.webhookSecret)
  };
};

import { ProviderFactory } from '../providers/ProviderFactory.js';
export const validateSourceCredentials = (provider: string, credentials: any) => {
  const adapter = ProviderFactory.getProvider(provider);
  return adapter.validateCredentials(credentials);
};

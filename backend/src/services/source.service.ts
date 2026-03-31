import { prisma } from '../utils/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.utils.js';

export class SourceService {
  static async createSource(
    userId: string,
    data: {
      keyId: string;
      keySecret: string;
      webhookSecret: string;
      name?: string;
    }
  ) {
    return prisma.paymentSource.create({
      data: {
        userId,
        keyId: data.keyId,
        keySecret: encrypt(data.keySecret),
        webhookSecret: encrypt(data.webhookSecret),
        name: data.name,
      },
      select: {
        id: true,
        userId: true,
        provider: true,
        name: true,
        keyId: true,
        webhookSecret: false,
        keySecret: false,
        createdAt: true,
      },
    });
  }

  static async getSources(userId: string) {
    return prisma.paymentSource.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        provider: true,
        name: true,
        keyId: true,
        createdAt: true,
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async deleteSource(userId: string, sourceId: string) {
    const source = await prisma.paymentSource.findFirst({
      where: { id: sourceId, userId },
    });
    if (!source) {
      const err = new Error('Source not found') as any;
      err.status = 404;
      throw err;
    }
    await prisma.paymentSource.delete({ where: { id: sourceId } });
  }

  // Used by webhook handler and worker — returns decrypted secrets.
  static async getSourceForWebhook(sourceId: string) {
    const source = await prisma.paymentSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) return null;
    return {
      ...source,
      keySecret: decrypt(source.keySecret),
      webhookSecret: decrypt(source.webhookSecret),
    };
  }
}

import { prisma } from '../utils/prisma.js';

export class AuditService {
  static async log(userId: string, action: string, resource: string | null = null, resourceId: string | null = null, details: any = null) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          details: details ? JSON.stringify(details) : null,
        },
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
      // Don't throw - audit logging should not block main application flow
    }
  }

  static async getLogs(userId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

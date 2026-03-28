import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { validateUrlForSSRF } from '../utils/security.js';
import { AuditService } from './audit.service.js';

export class MonitorService {
  private static async getDefaultProject(userId: string) {
    const project = await prisma.project.findFirst({
      where: { userId },
      select: { id: true }
    });
    
    if (project) return project;

    return prisma.project.create({
      data: { userId, name: 'Default Project' },
      select: { id: true }
    });
  }

  /**
   * Verified Scoping Wrapper
   * Ensures the monitor exists AND is owned by the project belonging to the user.
   */
  private static async getVerifiedMonitor(userId: string, monitorId: string) {
    return prisma.monitor.findFirst({
      where: { 
        id: monitorId,
        project: { userId } // Explicit cross-table ownership check
      },
      select: { id: true, url: true, projectId: true }
    });
  }

  static async createMonitor(userId: string, data: { name: string; url: string; method: string; interval: number }) {
    const { name, url, method, interval } = data;

    const isSafe = await validateUrlForSSRF(url);
    if (!isSafe) {
      const error = new Error('SSRF Security Violation: Local/Private URLs are forbidden.');
      (error as any).status = 403;
      throw error;
    }

    const project = await this.getDefaultProject(userId);

    const count = await prisma.monitor.count({ where: { projectId: project.id } });
    if (count >= 20) {
      const error = new Error('Monitor limit reached (Max 20)');
      (error as any).status = 403;
      throw error;
    }

    const monitorId = crypto.randomUUID();
    const monitor = await prisma.monitor.create({
      data: {
        id: monitorId,
        projectId: project.id,
        name: name || url,
        url,
        method,
        interval: Number(interval),
        status: 'UP',
        failureCount: 0
      }
    });

    await AuditService.log(userId, 'CREATE_MONITOR', 'Monitor', monitorId, { url, method });
    return monitor;
  }

  static async updateMonitor(userId: string, monitorId: string, data: Partial<{ name: string; url: string; method: string; interval: number; maintenanceUntil: Date | null }>) {
    const monitor = await this.getVerifiedMonitor(userId, monitorId);

    if (!monitor) {
      const error = new Error('Monitor not found or access denied');
      (error as any).status = 404;
      throw error;
    }

    if (data.url) {
      const isSafe = await validateUrlForSSRF(data.url);
      if (!isSafe) {
        const error = new Error('SSRF Violation for new URL');
        (error as any).status = 403;
        throw error;
      }
    }

    const updated = await prisma.monitor.update({
      where: { id: monitorId },
      data: {
        ...data,
        interval: data.interval ? Number(data.interval) : undefined
      }
    });

    await AuditService.log(userId, 'UPDATE_MONITOR', 'Monitor', monitorId, data);
    return updated;
  }

  static async getMonitors(userId: string) {
    // Optimized fetch with explicit user scoping
    const monitors = await prisma.monitor.findMany({
      where: { project: { userId } },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        method: true,
        interval: true,
        status: true,
        lastCheckedAt: true,
        failureCount: true,
        maintenanceUntil: true
      }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logsSummary = await prisma.log.groupBy({
      by: ['monitorId', 'status'],
      where: {
        monitorId: { in: monitors.map(m => m.id) },
        createdAt: { gte: thirtyDaysAgo }
      },
      _count: true
    });

    return monitors.map((monitor) => {
      const monitorLogs = logsSummary.filter(l => l.monitorId === monitor.id);
      const total = monitorLogs.reduce((acc, l) => acc + l._count, 0);
      const up = monitorLogs.find(l => l.status === 'UP')?._count || 0;
      const uptime30d = total > 0 ? parseFloat(((up / total) * 100).toFixed(2)) : 100;

      return { ...monitor, uptime30d };
    });
  }

  static async getMonitorById(userId: string, monitorId: string) {
    const monitor = await prisma.monitor.findFirst({
      where: { id: monitorId, project: { userId } },
      include: {
        logs: { orderBy: { createdAt: 'desc' }, take: 50 },
        incidents: { orderBy: { startedAt: 'desc' }, take: 20 }
      }
    });

    if (!monitor) {
      const error = new Error('Monitor not found or access denied');
      (error as any).status = 404;
      throw error;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const countData = await prisma.log.groupBy({
      by: ['status'],
      where: { monitorId, createdAt: { gte: thirtyDaysAgo } },
      _count: true
    });

    const total = countData.reduce((acc, c) => acc + c._count, 0);
    const up = countData.find(c => c.status === 'UP')?._count || 0;
    const uptime30d = total > 0 ? parseFloat(((up / total) * 100).toFixed(2)) : 100;

    return { ...monitor, uptime30d };
  }

  static async deleteMonitor(userId: string, monitorId: string) {
    const monitor = await this.getVerifiedMonitor(userId, monitorId);

    if (!monitor) {
      const error = new Error('Monitor not found or access denied');
      (error as any).status = 404;
      throw error;
    }

    await prisma.monitor.delete({ where: { id: monitorId } });
    await AuditService.log(userId, 'DELETE_MONITOR', 'Monitor', monitorId);
    return true;
  }
}

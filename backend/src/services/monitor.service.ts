import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { validateUrlForSSRF } from '../utils/security.js';

export class MonitorService {
  private static async getDefaultProject(userId: string) {
    let project = await prisma.project.findFirst({ where: { userId } });
    if (!project) {
      project = await prisma.project.create({
        data: {
          userId,
          name: 'Default Project',
        },
      });
    }
    return project;
  }

  static async createMonitor(userId: string, data: any) {
    const { name, url, method, interval } = data;

    // Phase 5: SSD/SSRF Protection - Block local/private URLs at API level
    const isSafe = await validateUrlForSSRF(url);
    if (!isSafe) {
      const error = new Error('SSRF Security Violation: Local/Private URLs are not allowed.');
      (error as any).status = 403;
      throw error;
    }

    const project = await this.getDefaultProject(userId);

    // Phase 4: Enforce Quotas (Max 20 limitation)
    const count = await prisma.monitor.count({
      where: { projectId: project.id }
    });

    if (count >= 20) {
      const error = new Error('You have reached the maximum limit of 20 monitors');
      (error as any).status = 403;
      throw error;
    }

    const id = crypto.randomUUID();

    // Raw insert for 'name' column support
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Monitor" (id, "projectId", name, url, method, interval, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, id, project.id, name || url, url, method, parseInt(interval, 10), 'UP');

    return { id, projectId: project.id, name: name || url, url, method, interval: parseInt(interval, 10), status: 'UP' };
  }

  static async getMonitors(userId: string) {
    const project = await this.getDefaultProject(userId);
    
    // Fetch monitors with raw SQL to include 'name'
    const monitors: any[] = await prisma.$queryRaw`
      SELECT * FROM "Monitor" WHERE "projectId" = ${project.id}
    `;

    const uptimeStats: any[] = await prisma.$queryRaw`
      SELECT 
        l."monitorId",
        COUNT(*)::float as total,
        COUNT(CASE WHEN l."status" = 'UP' THEN 1 END)::float as up
      FROM "Log" l
      JOIN "Monitor" m ON l."monitorId" = m.id
      WHERE m."projectId" = ${project.id}
      AND l."createdAt" > (NOW() - INTERVAL '30 days')
      GROUP BY l."monitorId"
    `;

    // Map stats back to monitors
    return monitors.map(m => {
      const stats = uptimeStats.find(s => s.monitorId === m.id);
      const uptime30d = stats && stats.total > 0 
        ? parseFloat(((stats.up / stats.total) * 100).toFixed(2)) 
        : 100; // Default to 100% if no logs

      return { 
        id: m.id,
        name: m.name || m.url,
        url: m.url,
        method: m.method,
        interval: m.interval,
        status: m.status,
        lastCheckedAt: m.lastCheckedAt,
        uptime30d 
      };
    });
  }

  static async getMonitorById(userId: string, monitorId: string) {
    const project = await this.getDefaultProject(userId);

    // Fetch with raw SQL to include 'name'
    const monitors: any[] = await prisma.$queryRaw`
      SELECT * FROM "Monitor" WHERE id = ${monitorId} AND "projectId" = ${project.id}
    `;
    const monitor = monitors[0];

    if (!monitor) {
      const error = new Error('Monitor not found');
      (error as any).status = 404;
      throw error;
    }

    // Include logs manually
    const logs = await prisma.log.findMany({ 
      where: { monitorId }, 
      orderBy: { createdAt: 'desc' }, 
      take: 50 
    });

    // Include incidents via raw SQL
    const incidents: any[] = await prisma.$queryRaw`
      SELECT * FROM "Incident" 
      WHERE "monitorId" = ${monitorId} 
      ORDER BY "startedAt" DESC 
      LIMIT 20
    `;

    // Calculate 30-day uptime for this specific monitor
    const uptimeResult: any[] = await prisma.$queryRaw`
      SELECT 
        COUNT(*)::float as total,
        COUNT(CASE WHEN "status" = 'UP' THEN 1 END)::float as up
      FROM "Log"
      WHERE "monitorId" = ${monitorId} AND "createdAt" > (NOW() - INTERVAL '30 days')
    `;

    const stats = uptimeResult[0];
    const uptime30d = stats && stats.total > 0 
      ? parseFloat(((stats.up / stats.total) * 100).toFixed(2)) 
      : 100;

    return { ...monitor, incidents, uptime30d };
  }

  static async deleteMonitor(userId: string, monitorId: string) {
    const project = await this.getDefaultProject(userId);

    const monitor = await prisma.monitor.findFirst({
      where: { id: monitorId, projectId: project.id },
    });

    if (!monitor) {
      const error = new Error('Monitor not found');
      (error as any).status = 404;
      throw error;
    }

    // Execute deletion atomically to prevent race condition locks from the background worker
    // Phase 6: Include cleanup of incidents
    await prisma.$transaction([
      prisma.log.deleteMany({ where: { monitorId } }),
      prisma.alert.deleteMany({ where: { monitorId } }),
      prisma.incident.deleteMany({ where: { monitorId } }),
      prisma.monitor.delete({ where: { id: monitorId } })
    ]);

    return true;
  }
}

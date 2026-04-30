import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../utils/prisma.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { logAuditAction } from '../services/audit.service.js';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/**
 * Handle organizational and team management logic.
 * Part of Phase 6: Team Support.
 */

export const getMyOrganizations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.userId! },
      include: { organization: true },
    });
    successResponse(res, memberships.map(m => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
    })));
  } catch (err) { next(err); }
};

// Single endpoint that returns orgs + members of the primary org, eliminating the
// two-request waterfall in Team.tsx (GET /my then GET /:id/members).
export const getMyTeamSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.userId! },
      include: { organization: true },
    });

    const orgs = memberships.map(m => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
    }));

    if (orgs.length === 0) {
      return successResponse(res, { orgs: [], activeOrg: null, members: [], total: 0 });
    }

    const activeOrg = orgs[0];
    const [members, total] = await Promise.all([
      prisma.membership.findMany({
        where: { organizationId: activeOrg.id },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.membership.count({ where: { organizationId: activeOrg.id } }),
    ]);

    successResponse(res, { orgs, activeOrg, members, total });
  } catch (err) { next(err); }
};

export const createOrganization = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse(res, 'Organization name is required', 400);
    }
    if (name.length > 100) return errorResponse(res, 'Name must be 100 characters or fewer', 400);

    const organization = await prisma.organization.create({
      data: {
        name,
        members: {
          create: {
            userId: req.userId!,
            role: 'owner',
          }
        }
      }
    });

    void logAuditAction(req.userId!, 'ORG_CREATE', 'Organization', organization.id, { name });
    successResponse(res, organization, 201);
  } catch (err) { next(err); }
};

export const getOrgMembers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = String(req.params.orgId || '');

    // Check if user has access to this org
    const membership = await prisma.membership.findFirst({
      where: { userId: req.userId!, organizationId: orgId },
    });

    if (!membership) return errorResponse(res, 'Access denied', 403);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const [members, total] = await Promise.all([
      prisma.membership.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, email: true, name: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.membership.count({ where: { organizationId: orgId } })
    ]);

    successResponse(res, { members, total, page, limit });
  } catch (err) { next(err); }
};

export const inviteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = String(req.params.orgId || '');
    const { email, role } = req.body;

    if (!email || !role) return errorResponse(res, 'Email and role are required', 400);

    // Check if requester is admin/owner
    const sender = await prisma.membership.findFirst({
      where: { 
        userId: req.userId!, 
        organizationId: orgId,
        role: { in: ['owner', 'admin'] }
      },
    });

    if (!sender) return errorResponse(res, 'Insufficient permissions', 403);

    // Find the user to invite — return the same response whether the email exists
    // or not to prevent registered-email enumeration.
    // Find the user to invite — if they don't exist, create a placeholder
    // user so they can be added to the organization immediately.
    let userToInvite = await prisma.user.findUnique({ where: { email } });
    if (!userToInvite) {
      userToInvite = await prisma.user.create({
        data: {
          email,
          emailVerified: false,
          plan: 'free',
        }
      });
    }

    // Check if already a member
    const existing = await prisma.membership.findFirst({
      where: { userId: userToInvite.id, organizationId: orgId }
    });
    if (existing) return errorResponse(res, 'User is already a member', 400);

    // Validate Role
    const allowedRoles = ['admin', 'member'];
    if (!allowedRoles.includes(role)) {
      return errorResponse(res, 'Invalid role. Allowed: admin, member', 400);
    }

    const newMember = await prisma.membership.create({
      data: {
        userId: userToInvite.id,
        organizationId: orgId,
        role,
      },
      include: { organization: true, user: true }
    });

    const inviter = await prisma.user.findUnique({ where: { id: req.userId! } });
    const { sendEmail } = await import('../services/resend.service.js');
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`;
    void sendEmail({
      to: userToInvite.email,
      subject: `You've been invited to join ${newMember.organization.name} on InvoiceFlow`,
      html: `<h2>Team Invitation</h2><p><strong>${esc(inviter?.name || 'A teammate')}</strong> has invited you to join <strong>${esc(newMember.organization.name)}</strong> on InvoiceFlow.</p><p><a href="${inviteLink}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">Go to Dashboard</a></p>`,
    }).catch((err: unknown) => console.error('[InviteEmail] Failed to send:', err));

    void logAuditAction(req.userId!, 'TEAM_INVITE', 'Organization', orgId, { invitedEmail: email, role });
    successResponse(res, newMember, 201);
  } catch (err) { next(err); }
};

export const updateMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = String(req.params.orgId || '');
    const targetUserId = String(req.params.userId || '');
    const { role } = req.body;

    const allowedRoles = ['admin', 'member'];
    if (!role || !allowedRoles.includes(role)) {
      return errorResponse(res, 'Invalid role. Allowed: admin, member', 400);
    }

    // Requester must be owner or admin
    const requester = await prisma.membership.findFirst({
      where: { userId: req.userId!, organizationId: orgId, role: { in: ['owner', 'admin'] } },
    });
    if (!requester) return errorResponse(res, 'Insufficient permissions', 403);

    // Target member must exist in this org
    const target = await prisma.membership.findFirst({
      where: { userId: targetUserId, organizationId: orgId },
    });
    if (!target) return errorResponse(res, 'Member not found', 404);

    // Cannot change an owner's role
    if (target.role === 'owner') return errorResponse(res, 'Cannot change owner role', 403);

    const updated = await prisma.membership.update({
      where: { id: target.id },
      data: { role },
    });
    void logAuditAction(req.userId!, 'TEAM_ROLE_UPDATE', 'Organization', orgId, { targetUserId, newRole: role });
    successResponse(res, updated);
  } catch (err) { next(err); }
};

export const removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = String(req.params.orgId || '');
    const targetUserId = String(req.params.userId || '');

    // Requester must be owner or admin
    const requester = await prisma.membership.findFirst({
      where: { userId: req.userId!, organizationId: orgId, role: { in: ['owner', 'admin'] } },
    });
    if (!requester) return errorResponse(res, 'Insufficient permissions', 403);

    // Target member must exist in this org
    const target = await prisma.membership.findFirst({
      where: { userId: targetUserId, organizationId: orgId },
    });
    if (!target) return errorResponse(res, 'Member not found', 404);

    // Owner cannot remove themselves
    if (targetUserId === req.userId! && requester.role === 'owner') {
      return errorResponse(res, 'Owner cannot remove themselves', 400);
    }

    // Cannot remove another owner
    if (target.role === 'owner' && targetUserId !== req.userId!) {
      return errorResponse(res, 'Cannot remove organization owner', 403);
    }

    await prisma.membership.delete({ where: { id: target.id } });
    void logAuditAction(req.userId!, 'TEAM_MEMBER_REMOVE', 'Organization', orgId, { removedUserId: targetUserId });
    successResponse(res, { removed: true });
  } catch (err) { next(err); }
};

export const updateOrganization = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = String(req.params.orgId || '');
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse(res, 'Organization name is required', 400);
    }
    if (name.length > 100) {
      return errorResponse(res, 'Name must be 100 characters or fewer', 400);
    }

    // Only owner can rename org
    const membership = await prisma.membership.findFirst({
      where: { userId: req.userId!, organizationId: orgId, role: 'owner' },
    });
    if (!membership) return errorResponse(res, 'Only the owner can update organization details', 403);

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { name: name.trim() },
    });
    void logAuditAction(req.userId!, 'ORG_RENAME', 'Organization', orgId, { name: name.trim() });
    successResponse(res, org);
  } catch (err) { next(err); }
};

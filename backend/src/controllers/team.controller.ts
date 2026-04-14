import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../utils/prisma.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

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

export const createOrganization = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name) return errorResponse(res, 'Organization name is required', 400);

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

    const members = await prisma.membership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    successResponse(res, members);
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

    // Find the user to invite
    const userToInvite = await prisma.user.findUnique({ where: { email } });
    if (!userToInvite) return errorResponse(res, 'User not found. They must register first.', 404);

    // Check if already a member
    const existing = await prisma.membership.findFirst({
      where: { userId: userToInvite.id, organizationId: orgId }
    });
    if (existing) return errorResponse(res, 'User is already a member', 400);

    const newMember = await prisma.membership.create({
      data: {
        userId: userToInvite.id,
        organizationId: orgId,
        role: role as string,
      }
    });

    successResponse(res, newMember, 201);
  } catch (err) { next(err); }
};

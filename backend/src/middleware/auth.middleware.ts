import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';

export type AuthRequest = Request & {
  userId?: string;
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Priority 1: Cookie
  let token = req.cookies?.token;

  // Priority 2: Authorization Header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    
    // CRITICAL: Verify user still exists in the database 
    // This handles cases where the DB was migrated/reset but the user has an old JWT
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true }
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized: User no longer exists' });
      return;
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

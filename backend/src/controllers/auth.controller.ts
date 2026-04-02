import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { registerUser, loginUser, verifyUserEmail, requestPassReset, completePassReset } from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { prisma } from '../utils/prisma.js';

const COOKIE_OPS = { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict' as const, path: '/', maxAge: 7 * 24 * 3600000 };

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, token } = await registerUser(req.body);
    res.cookie('token', token, COOKIE_OPS);
    successResponse(res, { user }, 201);
  } catch (err: any) {
    if (err.message === 'User already exists') return errorResponse(res, err.message, 400);
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, token } = await loginUser(req.body);
    res.cookie('token', token, COOKIE_OPS);
    successResponse(res, { user });
  } catch (err: any) {
    if (err.message === 'Invalid credentials') return errorResponse(res, err.message, 401);
    next(err);
  }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie('token', COOKIE_OPS);
  res.clearCookie('x-csrf-token', COOKIE_OPS);
  successResponse(res, { message: 'Logged out' });
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const r = await verifyUserEmail(String(req.query.token || ''));
    successResponse(res, r);
  } catch (err: any) { errorResponse(res, err.message, err.status || 400); }
};

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email required', 400);
    successResponse(res, await requestPassReset(email));
  } catch (err) { next(err); }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8) return errorResponse(res, 'Invalid data', 400);
    successResponse(res, await completePassReset(token, password));
  } catch (err: any) { errorResponse(res, err.message, err.status || 400); }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, plan: true, createdAt: true } });
    if (!u) return errorResponse(res, 'User not found', 404);
    successResponse(res, u);
  } catch (err) { next(err); }
};

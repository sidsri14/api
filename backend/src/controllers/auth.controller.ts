import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { prisma } from '../utils/prisma.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { user, token } = await AuthService.register(req.body);
    
    res.cookie('token', token, COOKIE_OPTIONS);
    successResponse(res, { user }, 201);
  } catch (error: any) {
    if (error.message === 'User already exists') {
      errorResponse(res, error.message, 400);
    } else {
      next(error);
    }
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { user, token } = await AuthService.login(req.body);
    
    res.cookie('token', token, COOKIE_OPTIONS);
    successResponse(res, { user }, 200);
  } catch (error: any) {
    if (error.message === 'Invalid credentials') {
      errorResponse(res, error.message, 401);
    } else {
      next(error);
    }
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  });
  successResponse(res, { message: 'Logged out successfully' }, 200);
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const result = await AuthService.verifyEmail(token);
    successResponse(res, result);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 400);
  }
};

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string') { errorResponse(res, 'Email is required', 400); return; }
    const result = await AuthService.requestPasswordReset(email);
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || typeof password !== 'string') {
      errorResponse(res, 'token and password are required', 400);
      return;
    }
    if (password.length < 8) { errorResponse(res, 'Password must be at least 8 characters', 400); return; }
    const result = await AuthService.resetPassword(token, password);
    successResponse(res, result);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 400);
  }
};

export const getMe = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, plan: true, createdAt: true },
    });

    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

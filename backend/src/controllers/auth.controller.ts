import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { registerUser, loginUser, verifyUserEmail, requestPassReset, completePassReset, updateUserProfile, changeUserPassword } from '../services/auth.service.js';
import { findOrCreateGoogleUser } from '../services/google-auth.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { prisma } from '../utils/prisma.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPS = { 
  httpOnly: true, 
  secure: isProd, 
  sameSite: (isProd ? 'none' : 'strict') as const, 
  path: '/', 
  maxAge: 7 * 24 * 3600000 
};

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
  res.clearCookie('csrf-token', { ...COOKIE_OPS, httpOnly: false });
  successResponse(res, { message: 'Logged out' });
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    // Token arrives in POST body (frontend sends { token }) or query string (direct link click).
    // Guard against array values e.g. ?token=a&token=b which Express parses as string[].
    const queryToken = Array.isArray(req.query.token) ? '' : String(req.query.token || '');
    const token = req.body?.token || queryToken;
    const r = await verifyUserEmail(token);
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

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await updateUserProfile(req.userId!, req.body);
    successResponse(res, { user });
  } catch (err: any) {
    if (err.message === 'Email already in use') return errorResponse(res, err.message, 400);
    next(err);
  }
};

export const updatePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 8) {
      return errorResponse(res, 'New password must be at least 8 characters', 400);
    }
    const result = await changeUserPassword(req.userId!, oldPassword, newPassword);
    successResponse(res, result);
  } catch (err: any) {
    if (err.message === 'Incorrect current password') return errorResponse(res, err.message, 401);
    if (err.message === 'Account uses Google sign-in — no password to change') return errorResponse(res, err.message, 400);
    next(err);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, plan: true, createdAt: true }
    });
    if (!u) return errorResponse(res, 'User not found', 404);
    successResponse(res, u);
  } catch (err) { next(err); }
};

// Configure Google OAuth strategy (executed once at module load time)
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const result = await findOrCreateGoogleUser(profile);
      done(null, result);
    } catch (err) {
      done(err as Error);
    }
  }
));

export const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});

export const googleCallback = [
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_failed`,
  }),
  (req: any, res: Response) => {
    const { token } = req.user as { user: any; token: string };
    res.cookie('token', token, COOKIE_OPS);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`);
  },
];

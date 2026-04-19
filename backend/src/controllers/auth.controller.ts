import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { registerUser, loginUser, verifyUserEmail, requestPassReset, completePassReset, updateUserProfile, changeUserPassword, setUserPassword } from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';

const isProd = process.env.NODE_ENV === 'production';
export const COOKIE_OPS = { 
  httpOnly: true, 
  secure: isProd, 
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
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

export const googleAuthCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any; // From Passport
    if (!user || !user.id) {
      return res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/login?error=oauth_failed');
    }
    
    const token = generateToken(user.id);
    res.cookie('token', token, COOKIE_OPS);
    
    // Redirect to dashboard on successful login
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/dashboard');
  } catch (err) {
    next(err);
  }
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
    next(err);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, plan: true, createdAt: true, password: true, googleId: true, brandSettings: true, brandEmailSubject: true, brandEmailTone: true }
    });
    if (!u) return errorResponse(res, 'User not found', 404);
    const { password, googleId, ...rest } = u;
    successResponse(res, { ...rest, hasPassword: password !== null, googleLinked: googleId !== null });
  } catch (err) { next(err); }
};

export const updateBranding = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { brandSettings, brandEmailSubject, brandEmailTone } = req.body;

    if (brandEmailSubject !== undefined && (typeof brandEmailSubject !== 'string' || brandEmailSubject.length > 200)) {
      return errorResponse(res, 'emailSubject must be a string under 200 characters', 400);
    }
    const allowedTones = ['professional', 'friendly', 'urgent'];
    if (brandEmailTone !== undefined && !allowedTones.includes(brandEmailTone)) {
      return errorResponse(res, 'emailTone must be professional, friendly, or urgent', 400);
    }
    if (brandSettings !== undefined) {
      if (typeof brandSettings !== 'object' || Array.isArray(brandSettings)) {
        return errorResponse(res, 'brandSettings must be an object', 400);
      }
      const { primaryColor, logoUrl, signature } = brandSettings as Record<string, unknown>;
      if (primaryColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(primaryColor))) {
        return errorResponse(res, 'primaryColor must be a valid hex color (e.g. #10b981)', 400);
      }
      if (logoUrl !== undefined) {
        try { const u = new URL(String(logoUrl)); if (u.protocol !== 'https:') throw new Error(); }
        catch { return errorResponse(res, 'logoUrl must be a valid https URL', 400); }
      }
      if (signature !== undefined && (typeof signature !== 'string' || (signature as string).length > 500)) {
        return errorResponse(res, 'signature must be a string under 500 characters', 400);
      }
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { brandSettings, brandEmailSubject, brandEmailTone },
      select: { id: true, email: true, name: true, plan: true, createdAt: true, brandSettings: true, brandEmailSubject: true, brandEmailTone: true, password: true, googleId: true }
    });
    const { password, googleId, ...rest } = user;
    successResponse(res, { user: { ...rest, hasPassword: password !== null, googleLinked: googleId !== null } });
  } catch (err) { next(err); }
};

export const setPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    const result = await setUserPassword(req.userId!, password);
    successResponse(res, result);
  } catch (err: any) {
    if (err.status === 400) return errorResponse(res, err.message, 400);
    next(err);
  }
};

export const sendTestEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { email: true, brandSettings: true, brandEmailSubject: true, brandEmailTone: true }
    });

    if (!user) return errorResponse(res, 'User not found', 404);

    let branding: any = {};
    if (user.brandSettings) {
      try { branding = JSON.parse(user.brandSettings as any); } catch (e) {}
    }
    branding.emailSubject = user.brandEmailSubject || branding.emailSubject;
    branding.emailTone = user.brandEmailTone || branding.emailTone;

    const { sendPaymentFailedEmail } = await import('../services/email.service.js');
    
    await sendPaymentFailedEmail(user.email, {
      customerName: user.name || 'Test User',
      amount: 149900, // ₹1,499.00
      currency: 'INR',
      paymentLink: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/dashboard?test=1',
      paymentId: 'pay_test_12345'
    }, branding);

    successResponse(res, { message: 'Test email dispatched' });
  } catch (err) { next(err); }
};

export const sendTestSms = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return errorResponse(res, 'Phone number required', 400);

    const { SmsService } = await import('../services/SmsService.js');
    await SmsService.sendRecoverySms(
      phoneNumber,
      'Test User',
      149900,
      'INR',
      (process.env.FRONTEND_URL || 'http://localhost:5173') + '/dashboard?test=1'
    );

    successResponse(res, { message: 'Test SMS dispatched' });
  } catch (err) { next(err); }
};

export const sendTestWhatsApp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return errorResponse(res, 'Phone number required', 400);

    const { SmsService } = await import('../services/SmsService.js');
    await SmsService.sendRecoveryWhatsApp(
      phoneNumber,
      'Test User',
      149900,
      'INR',
      (process.env.FRONTEND_URL || 'http://localhost:5173') + '/dashboard?test=1'
    );

    successResponse(res, { message: 'Test WhatsApp dispatched' });
  } catch (err) { next(err); }
};

import { Router } from 'express';
import { register, login, logout, getMe, verifyEmail, requestPasswordReset, resetPassword, updateProfile, updatePassword, googleAuthCallback, setPassword, updateBranding, sendTestEmail, sendTestSms, sendTestWhatsApp } from '../controllers/auth.controller.js';
import passport from 'passport';
import { requireAuth } from '../middleware/auth.middleware.js';
import { csrfCheck } from '../middleware/csrf.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { registerSchema, loginSchema, setPasswordSchema } from '../validators/auth.validator.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Public state-changing routes — CSRF required but no auth yet
router.post('/register', csrfCheck, authLimiter, validateRequest(registerSchema), register);
router.post('/login', csrfCheck, authLimiter, validateRequest(loginSchema), login);

// OAuth routes — stateless JWT setup: state stored in a short-lived cookie and
// verified on callback to prevent OAuth CSRF / account-hijacking.
import crypto from 'crypto';
const OAUTH_STATE_COOKIE = 'oauth-state';
const isProd = process.env.NODE_ENV !== 'development';

router.get('/google', (req, res, next) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 10 * 60 * 1000, // 10 min — enough to complete OAuth flow
  });
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
  const queryState = req.query.state as string | undefined;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!cookieState || !queryState || cookieState !== queryState) {
    return res.redirect(`${frontendUrl}/login?error=oauth_state_mismatch`);
  }
  res.clearCookie(OAUTH_STATE_COOKIE);
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${frontendUrl}/login?error=oauth_failed`,
  })(req, res, next);
}, googleAuthCallback);

router.post('/logout', csrfCheck, logout);
router.post('/verify-email', csrfCheck, verifyEmail);
router.post('/forgot-password', csrfCheck, authLimiter, requestPasswordReset);
router.post('/reset-password', csrfCheck, authLimiter, resetPassword);
// Read-only routes — no CSRF needed
router.get('/me', requireAuth, getMe);

// Protected update routes
router.patch('/profile', requireAuth, csrfCheck, updateProfile);
router.patch('/password', requireAuth, csrfCheck, updatePassword);
router.patch('/set-password', requireAuth, csrfCheck, validateRequest(setPasswordSchema), setPassword);
router.patch('/branding', requireAuth, csrfCheck, updateBranding);
router.post('/test-email', requireAuth, csrfCheck, sendTestEmail);
router.post('/test-sms', requireAuth, csrfCheck, sendTestSms);
router.post('/test-whatsapp', requireAuth, csrfCheck, sendTestWhatsApp);

export default router;

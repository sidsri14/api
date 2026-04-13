import { Router } from 'express';
import { register, login, logout, getMe, verifyEmail, requestPasswordReset, resetPassword, updateProfile, updatePassword, googleAuthCallback, setPassword, updateBranding } from '../controllers/auth.controller.js';
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

// OAuth routes (no CSRF expected on the initial GET or callback redirect)
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/login?error=oauth_failed' }), googleAuthCallback);

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

export default router;

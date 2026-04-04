import { Router } from 'express';
import { register, login, logout, getMe, verifyEmail, requestPasswordReset, resetPassword, updateProfile, updatePassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { csrfCheck } from '../middleware/csrf.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Public state-changing routes — CSRF required but no auth yet
router.post('/register', csrfCheck, authLimiter, validateRequest(registerSchema), register);
router.post('/login', csrfCheck, authLimiter, validateRequest(loginSchema), login);
router.post('/logout', csrfCheck, logout);
router.post('/verify-email', csrfCheck, verifyEmail);
router.post('/forgot-password', csrfCheck, authLimiter, requestPasswordReset);
router.post('/reset-password', csrfCheck, authLimiter, resetPassword);
// Read-only routes — no CSRF needed
router.get('/me', requireAuth, getMe);

// Protected update routes
router.patch('/profile', requireAuth, csrfCheck, updateProfile);
router.patch('/password', requireAuth, csrfCheck, updatePassword);

export default router;

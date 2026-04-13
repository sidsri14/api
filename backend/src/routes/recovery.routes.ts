import { Router } from 'express';
import { trackClick } from '../controllers/recovery.controller.js';

const router = Router();

/**
 * Public tracking route.
 * Redirects to the actual recovery link while logging the click event.
 */
router.get('/track/:failedPaymentId', trackClick);

export default router;

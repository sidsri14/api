import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { DemoController } from '../controllers/demo.controller.js';

// Tight rate limit for public invoice lookup — prevents ID enumeration
const demoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.get('/invoice/:id', demoLimiter, DemoController.getInvoice);
router.get('/invoice/:id/pdf', demoLimiter, DemoController.getInvoicePdf);
router.post('/pay/:id', demoLimiter, DemoController.payInvoice);
router.post('/create', demoLimiter, DemoController.createDemoInvoice);

export default router;

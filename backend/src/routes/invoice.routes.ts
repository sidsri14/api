import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { csrfCheck } from '../middleware/csrf.middleware.js';

const router = Router();

router.post('/', requireAuth, csrfCheck, InvoiceController.create);
router.get('/', requireAuth, InvoiceController.list);
router.get('/:id', requireAuth, InvoiceController.get);
router.delete('/:id', requireAuth, csrfCheck, InvoiceController.delete);
router.post('/:id/remind', requireAuth, csrfCheck, InvoiceController.remind);
router.get('/:id/pdf', requireAuth, InvoiceController.getPdf);

export default router;

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { csrfCheck } from '../middleware/csrf.middleware.js';
import { listApiKeys, createApiKey, updateApiKey, deleteApiKey } from '../controllers/apiKeys.controller.js';

const router = Router();

router.get('/',       requireAuth,                listApiKeys);
router.post('/',      csrfCheck, requireAuth,     createApiKey);
router.patch('/:id',  csrfCheck, requireAuth,     updateApiKey);
router.delete('/:id', csrfCheck, requireAuth,     deleteApiKey);

export default router;

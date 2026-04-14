import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { csrfCheck } from '../middleware/csrf.middleware.js';
import {
  listEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  testEndpoint,
} from '../controllers/webhookEndpoints.controller.js';

const router = Router();

router.get('/',        requireAuth,                   listEndpoints);
router.post('/',       csrfCheck, requireAuth,         createEndpoint);
router.patch('/:id',   csrfCheck, requireAuth,         updateEndpoint);
router.delete('/:id',  csrfCheck, requireAuth,         deleteEndpoint);
router.post('/:id/test', csrfCheck, requireAuth,       testEndpoint);

export default router;

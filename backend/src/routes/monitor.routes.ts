import { Router } from 'express';
import { createMonitor, getMonitors, getMonitor, deleteMonitor, updateMonitor } from '../controllers/monitor.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { createMonitorSchema, updateMonitorSchema } from '../validators/monitor.validator.js';
import { apiLimiter, createMonitorLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.use(requireAuth); // Protect all routes below
router.use(apiLimiter); // Apply general API rate limiting

router.post('/', createMonitorLimiter, validateRequest(createMonitorSchema), createMonitor);
router.get('/', getMonitors);
router.get('/:id', getMonitor);
router.put('/:id', validateRequest(updateMonitorSchema), updateMonitor);
router.delete('/:id', deleteMonitor);

export default router;

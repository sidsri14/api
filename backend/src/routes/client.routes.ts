import { Router } from 'express';
import { ClientController } from '../controllers/client.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/', ClientController.create);
router.get('/', ClientController.list);
router.patch('/:id', ClientController.update);
router.delete('/:id', ClientController.delete);

export default router;

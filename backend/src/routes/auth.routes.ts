// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register as any);
router.post('/login', login as any);
router.post('/logout', logout as any);
router.get('/me', authMiddleware as any, getMe as any);

export default router;
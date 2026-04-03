// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);  // ← Добавить этот маршрут
router.get('/me', getMe);

export default router;
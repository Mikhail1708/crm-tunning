// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register as any);
router.post('/login', login as any);
router.post('/logout', logout as any);
router.get('/me', authMiddleware as any, getMe as any);

// ✅ Добавляем эндпоинт для получения CSRF токена
router.get('/csrf-token', (req, res) => {
  // Генерируем простой токен
  const token = require('crypto').randomBytes(32).toString('hex');
  // Сохраняем в cookie
  res.cookie('csrf-token', token, {
    httpOnly: false, // Доступно для JS
    secure: true,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ csrfToken: token });
});

export default router;

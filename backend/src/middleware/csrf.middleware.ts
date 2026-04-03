// backend/src/middleware/csrf.middleware.ts
import { Request, Response, NextFunction } from 'express';
import csrf from 'csurf';

// Настройка CSRF защиты
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    key: '_csrf'
  }
});

// Middleware для генерации и отправки CSRF токена на фронтенд
export const csrfTokenHandler = (req: Request, res: Response, next: NextFunction) => {
  // Генерируем токен
  const token = (req as any).csrfToken ? (req as any).csrfToken() : null;
  
  if (token) {
    // Отправляем токен в cookie (доступен для JS)
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 часа
    });
  }
  next();
};

// Middleware для проверки CSRF токена (только для не-GET запросов)
export const csrfValidate = (req: Request, res: Response, next: NextFunction) => {
  // Пропускаем GET, HEAD, OPTIONS запросы
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Пропускаем auth маршруты (логин, регистрация)
  if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
    return next();
  }
  
  // Пропускаем маршрут получения CSRF токена
  if (req.path === '/csrf-token') {
    return next();
  }
  
  // Проверяем CSRF токен в заголовке
  const token = req.headers['x-csrf-token'] || req.headers['xsrf-token'];
  
  if (!token) {
    console.warn('CSRF token missing in request headers');
    res.status(403).json({ error: 'CSRF токен отсутствует' });
    return;
  }
  
  // Получаем токен из cookie
  const cookieToken = req.cookies['XSRF-TOKEN'];
  
  if (!cookieToken) {
    console.warn('CSRF cookie missing');
    res.status(403).json({ error: 'CSRF cookie отсутствует' });
    return;
  }
  
  // Сравниваем токены
  if (token !== cookieToken) {
    console.warn('CSRF token mismatch');
    res.status(403).json({ error: 'Неверный CSRF токен' });
    return;
  }
  
  next();
};
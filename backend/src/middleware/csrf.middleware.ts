// backend/src/middleware/csrf.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { RequestWithUser } from '../types';

const crypto = require('crypto');

// Хранилище токенов (в production используйте Redis)
const tokenStore = new Map<string, { token: string; expires: number }>();

export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Получить CSRF токен (для отправки на фронтенд)
export const getCsrfToken = (req: Request, res: Response) => {
  const token = generateCsrfToken();
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 часа
  
  // Сохраняем токен для сессии
  const sessionId = req.cookies?.['session-id'] || crypto.randomBytes(16).toString('hex');
  tokenStore.set(sessionId, { token, expires });
  
  // Устанавливаем cookie
  res.cookie('csrf-token', token, {
    httpOnly: false, // Должен быть доступен из JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });
  
  res.cookie('session-id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });
  
  return token;
};

// Middleware для проверки CSRF токена
export const csrfProtection = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Пропускаем GET, HEAD, OPTIONS запросы
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Пропускаем в разработке (опционально)
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️ CSRF protection disabled in development');
    return next();
  }
  
  // Получаем токен из заголовка
  const csrfToken = req.headers['x-csrf-token'] || req.headers['xsrf-token'];
  const cookieToken = req.cookies?.['csrf-token'];
  
  if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
    console.error('CSRF validation failed:', { csrfToken: !!csrfToken, cookieToken: !!cookieToken });
    res.status(403).json({ error: 'CSRF token validation failed' });
    return;
  }
  
  next();
};

// Middleware для установки CSRF токена
export const setCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  getCsrfToken(req, res);
  next();
};
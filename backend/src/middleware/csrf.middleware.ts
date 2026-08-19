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
    httpOnly: false,
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

// Список публичных путей, для которых НЕ нужна CSRF-защита
const PUBLIC_PATHS = [
  '/api/sale-documents/public',
  '/api/public',
  '/public',
  '/api/health',
  '/api/csrf/token',
];

// Проверка, является ли путь публичным
const isPublicPath = (path: string): boolean => {
  return PUBLIC_PATHS.some(publicPath => path.includes(publicPath));
};

// Middleware для проверки CSRF токена
export const csrfProtection = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // 1. Пропускаем GET, HEAD, OPTIONS запросы
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // 2. Пропускаем публичные эндпоинты (ПО ЛЮБОМУ ПУТИ)
  if (isPublicPath(req.path) || isPublicPath(req.originalUrl)) {
    console.log(`🔓 Пропускаем CSRF для публичного эндпоинта: ${req.method} ${req.path}`);
    return next();
  }
  
  // 3. В режиме разработки отключаем CSRF полностью (для удобства)
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️ CSRF protection disabled in development');
    return next();
  }
  
  // 4. Проверяем CSRF токен
  const csrfToken = req.headers['x-csrf-token'] || req.headers['xsrf-token'] || req.headers['csrf-token'];
  const cookieToken = req.cookies?.['csrf-token'];
  
  console.log('🔒 CSRF проверка:', { 
    hasCsrfToken: !!csrfToken, 
    hasCookieToken: !!cookieToken,
    match: csrfToken === cookieToken
  });
  
  if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
    console.error('❌ CSRF validation failed:', { 
      csrfToken: !!csrfToken, 
      cookieToken: !!cookieToken,
      path: req.path,
      method: req.method
    });
    res.status(403).json({ error: 'CSRF validation failed' });
    return;
  }
  
  next();
};

// Middleware для установки CSRF токена
export const setCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  getCsrfToken(req, res);
  next();
};
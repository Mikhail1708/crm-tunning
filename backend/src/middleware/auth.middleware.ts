// backend/src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RequestWithUser } from '../types';
import { CRM_AUTH_COOKIE, CRM_JWT_AUDIENCE, CRM_JWT_ISSUER } from '../utils/authCookie';

interface JwtPayload {
  id: number | string;
  email: string;
  name: string;
  role: string;
}

// ============================================================
// ПУБЛИЧНЫЕ ПУТИ (НЕ ТРЕБУЮТ JWT)
// ============================================================
const PUBLIC_PATHS = [
  '/api/sale-documents/public',
  '/api/public',
  '/api/health',
  '/api/auth/login',
  '/api/auth/reset-password',
  '/api/auth/csrf-token',
  '/api/webhooks',
];

const isPublicPath = (path: string): boolean => {
  if (path === '/api/sale-documents/public') return true;
  if (path === '/api/health') return true;
  if (path.startsWith('/api/public/')) return true;
  if (path.startsWith('/api/webhooks/')) return true;
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
};

export const authMiddleware = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // ✅ ПРОПУСКАЕМ ПУБЛИЧНЫЕ ПУТИ
  if (isPublicPath(req.path) || isPublicPath(req.originalUrl)) {
    console.log(`✅ Пропускаем JWT для публичного эндпоинта: ${req.method} ${req.path}`);
    return next();
  }

  try {
    let token = req.cookies?.[CRM_AUTH_COOKIE];
    
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    
    console.log('Auth middleware - token exists:', !!token);
    console.log('Auth middleware - path:', req.path);
    
    if (!token) {
      console.log('No token, sending 401');
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        issuer: CRM_JWT_ISSUER,
        audience: CRM_JWT_AUDIENCE,
      }) as JwtPayload;
      
      console.log('Token verified for user:', decoded.email || decoded.id);
      
      // ✅ ПРИВОДИМ id К number (ЕСЛИ СТРОКА — ПАРСИМ)
      const userId = typeof decoded.id === 'string' ? parseInt(decoded.id) : decoded.id;
      
      req.user = {
        id: userId,
        email: decoded.email || '',
        name: decoded.name || '',
        role: decoded.role || 'user'
      };
      
      console.log('User set, proceeding to next middleware');
      next();
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      res.status(401).json({ error: 'Недействительный токен' });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Недействительный токен' });
  }
};

export const adminMiddleware = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }
  
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    return;
  }
  
  next();
};

export const managerAccess = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    res.status(403).json({ error: 'Доступ запрещен' });
    return;
  }
  
  next();
};

// backend/src/middleware/auth.middleware.ts

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { CRM_JWT_ALGORITHM, getJwtSecret } from '../config/jwt';
import { isAuthGeneration } from '../services/authRevocation.service';
import { RequestWithUser } from '../types';
import { CRM_AUTH_COOKIE, CRM_JWT_AUDIENCE, CRM_JWT_ISSUER } from '../utils/authCookie';

const prisma = new PrismaClient();

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

  delete req.user;
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
      const decoded = jwt.verify(token, getJwtSecret(), {
        algorithms: [CRM_JWT_ALGORITHM],
        issuer: CRM_JWT_ISSUER,
        audience: CRM_JWT_AUDIENCE,
      });
      // JWT proves identity only. Never authorize using cached role/name/email claims.
      const id = typeof decoded === 'object' ? decoded.id : undefined;
      const userId = typeof id === 'string' && /^[1-9]\d*$/.test(id) ? Number(id) : id;
      if (!Number.isSafeInteger(userId) || userId <= 0 || typeof decoded !== 'object'
          || !Number.isSafeInteger(decoded.exp) || !isAuthGeneration(decoded.authGeneration)) {
        res.status(401).json({ error: 'Недействительный токен' });
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, role: true, authGeneration: true },
      });
      if (!user || user.authGeneration !== decoded.authGeneration) {
        res.status(401).json({ error: 'Недействительный токен' });
        return;
      }
      req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
      
      console.log('User set, proceeding to next middleware');
      next();
    } catch (jwtError) {
      // Fail closed, including DB/config errors; do not log raw errors or credentials.
      delete req.user;
      console.error('Authentication failed');
      res.status(401).json({ error: 'Недействительный токен' });
      return;
    }
  } catch (error) {
    delete req.user;
    console.error('Authentication failed');
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

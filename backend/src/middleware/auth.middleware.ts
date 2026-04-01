// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RequestWithUser } from '../types';

interface JwtPayload {
  id: number;
  email: string;
  name: string;
  role: string;
}

/**
 * Middleware для проверки JWT токена
 */
export const authMiddleware = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Недействительный токен' });
  }
};

/**
 * Middleware для проверки прав администратора
 */
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

/**
 * Middleware для проверки прав менеджера или администратора
 */
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
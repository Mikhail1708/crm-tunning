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

export const authMiddleware = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.token;
    
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    
    console.log('Auth middleware - token exists:', !!token);
    
    if (!token) {
      console.log('No token, sending 401');
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      console.log('Token verified for user:', decoded.email);
      
      req.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role
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
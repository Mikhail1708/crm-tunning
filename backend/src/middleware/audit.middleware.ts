// backend/src/middleware/audit.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { RequestWithUser } from '../types';
import auditService from '../services/audit.service';

/**
 * Middleware для логирования действий пользователей
 */
export const auditLog = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Сохраняем оригинальный метод res.json
  const originalJson = res.json;
  
  // Переопределяем res.json для логирования после отправки ответа
  res.json = function(body: any): Response {
    // Если есть пользователь и это не GET запрос (GET не логируем)
    if (req.user && req.method !== 'GET') {
      const action = `${req.method} ${req.baseUrl}${req.path}`;
      const details = {
        method: req.method,
        path: req.path,
        body: req.method !== 'GET' ? req.body : undefined,
        query: req.query,
        params: req.params,
        responseStatus: res.statusCode
      };
      
      // Логируем действие
      auditService.log(req.user, action, details);
    }
    
    // Вызываем оригинальный метод
    return originalJson.call(this, body);
  };
  
  next();
};
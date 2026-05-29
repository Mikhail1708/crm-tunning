// backend/src/middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';

// Глобальный лимит для всех запросов (защита от DDoS)
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 500,
  message: { error: 'Слишком много запросов, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  // Используем ipKeyGenerator для корректной работы с IPv6
  keyGenerator: (req) => {
    // Просто возвращаем IP без дополнительных проверок
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           req.socket.remoteAddress || 
           'unknown';
  }
});

// Строгий лимит для авторизации (защита от брутфорса)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           req.socket.remoteAddress || 
           'unknown';
  }
});

// Лимит для API запросов
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Слишком много запросов, подождите немного' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           req.socket.remoteAddress || 
           'unknown';
  }
});

// Супер строгий лимит для создания заказов
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Слишком много заказов. Подождите немного' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           req.socket.remoteAddress || 
           'unknown';
  }
});

export const logRateLimitStatus = () => {
  console.log('✅ Rate limiting configured');
};
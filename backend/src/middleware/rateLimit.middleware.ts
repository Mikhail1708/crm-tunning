// backend/src/middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';

// Глобальный лимит для всех запросов (защита от DDoS)
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 500, // 500 запросов в минуту (увеличено для легитимного трафика)
  message: { error: 'Слишком много запросов, попробуйте позже' },
  standardHeaders: true, // Возвращать rate limit в headers
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
});

// Строгий лимит для авторизации (защита от брутфорса)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // 10 попыток входа
  skipSuccessfulRequests: true, // Не считать успешные входы
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для API запросов
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 200, // 200 запросов в минуту
  message: { error: 'Слишком много запросов, подождите немного' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Супер строгий лимит для создания заказов
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 30, // максимум 30 заказов в минуту
  message: { error: 'Слишком много заказов. Подождите немного' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const logRateLimitStatus = () => {
  console.log('✅ Rate limiting configured');
};
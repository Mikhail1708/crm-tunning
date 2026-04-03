// backend/src/middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';

// Глобальный лимит для всех запросов
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 200, // 200 запросов в минуту
  message: { error: 'Слишком много запросов, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Строгий лимит для авторизации (защита от брутфорса)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток входа
  skipSuccessfulRequests: true, // Не считать успешные входы
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для API запросов
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 100, // 100 запросов в минуту
  message: { error: 'Слишком много запросов, подождите немного' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Функция для отладки (необязательно)
export const logRateLimitStatus = () => {
  console.log('✅ Rate limiting configured (in-memory storage, resets on server restart)');
};
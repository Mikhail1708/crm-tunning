// backend/src/middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';

// Общий лимит для всех запросов (увеличил)
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 300, // 200 запросов в минуту (было 100)
  message: { error: 'Слишком много запросов, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Строгий лимит для авторизации (оставляем строгим)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // 10 попыток входа (было 5)
  skipSuccessfulRequests: true,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API лимит для защищенных маршрутов (увеличил)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 200, // 100 запросов в минуту (было 30)
  message: { error: 'Слишком много запросов, подождите немного' },
  standardHeaders: true,
  legacyHeaders: false,
});
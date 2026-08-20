// crm-project/backend/src/server.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/products.routes';
import categoryRoutes from './routes/categories.routes';
import saleDocumentRoutes from './routes/saleDocuments.routes';
import { startInventoryReservationExpiryWorker } from './controllers/inventoryReservations.controller';
import clientRoutes from './routes/clients.routes';
import auditRoutes from './routes/audit.routes';
import reportsRoutes from './routes/reports.routes';
import publicRoutes from './routes/public.routes';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  const missingWebhookConfig = ['SITE_WEBHOOK_URL', 'WEBHOOK_SECRET']
    .filter(name => !process.env[name]);
  if (missingWebhookConfig.length > 0) {
    throw new Error(`Missing CRM status sync configuration: ${missingWebhookConfig.join(', ')}`);
  }
}

const app = express();

// ============================================================
// 1. CORS
// ============================================================
const allowedOrigins = [
  'https://swapcrm38.ru',
  'https://www.swapcrm38.ru',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Cookie', 'Authorization', 'X-API-Key', 'X-CSRF-Token', 'XSRF-Token', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400,
}));

// ============================================================
// 2. MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Раздача статических файлов (фото товаров)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// 2.5 RATE LIMIT ДЛЯ ПУБЛИЧНЫХ ЭНДПОИНТОВ
// ============================================================
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 500, // 500 запросов в минуту (было 100)
  message: { error: 'Слишком много запросов, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           req.socket.remoteAddress || 
           'unknown';
  }
});

// ============================================================
// 3. ПУБЛИЧНЫЕ ПУТИ (без CSRF)
// ============================================================
const PUBLIC_PATHS = [
  '/api/sale-documents/public',
  '/api/sale-documents/internal',
  '/api/public',
  '/api/health',
  '/api/auth/csrf-token',
  '/api/auth/login',
  '/api/auth/reset-password',
  '/api/webhooks',
];

const isPublicPath = (path: string): boolean => {
  return PUBLIC_PATHS.some(publicPath => 
    path === publicPath || 
    path.startsWith(`${publicPath}/`)
  );
};

// ============================================================
// 4. CSRF ТОКЕН
// ============================================================
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf-token', token, { 
    httpOnly: false, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ csrfToken: token });
});

// ============================================================
// 5. CSRF ПРОВЕРКА
// ============================================================
app.use((req, res, next) => {
  if (isPublicPath(req.path) || isPublicPath(req.originalUrl)) {
    console.log(`✅ Пропускаем CSRF для: ${req.method} ${req.path}`);
    return next();
  }

  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) {
    return next();
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`⚠️ CSRF отключен в development: ${req.method} ${req.path}`);
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.headers['csrf-token'] || req.headers['x-xsrf-token'];
  const cookieToken = req.cookies?.['csrf-token'];

  if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
    console.error(`❌ CSRF validation failed: ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  next();
});

// ============================================================
// 6. РОУТЫ
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sale-documents', saleDocumentRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportsRoutes);

// Публичные роуты С RATE LIMIT
app.use('/api/public', publicLimiter);
app.use('/api/public', publicRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// ============================================================
// 7. ЗАПУСК
// ============================================================
const PORT = parseInt(process.env.PORT || '5000', 10);

app.listen(PORT, '0.0.0.0', () => {
  startInventoryReservationExpiryWorker();
  console.log(`🚀 CRM Server running on port ${PORT}`);
  console.log(`📋 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
  console.log(`📦 Public API: http://localhost:${PORT}/api/public (rate limit: 500/min)`);
});

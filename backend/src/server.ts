// backend/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import os from 'os';
import { globalLimiter, authLimiter, apiLimiter, logRateLimitStatus } from './middleware/rateLimit.middleware';
import { csrfProtection, csrfTokenHandler, csrfValidate } from './middleware/csrf.middleware';

dotenv.config();

const app = express();

// Helmet для безопасных заголовков
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// Настройка CORS для работы с cookie
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Cookie', 'Authorization', 'X-CSRF-Token', 'XSRF-Token'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Глобальный лимит для всех запросов
app.use(globalLimiter);

// Подключаем маршруты
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/products.routes';
import categoryRoutes from './routes/categories.routes';
import saleRoutes from './routes/sales.routes';
import reportRoutes from './routes/reports.routes';
import saleDocumentRoutes from './routes/saleDocuments.routes';
import clientRoutes from './routes/clients.routes';
import auditRoutes from './routes/audit.routes';
import { auditLog } from './middleware/audit.middleware';
import { authMiddleware } from './middleware/auth.middleware';

// ============ ПУБЛИЧНЫЕ МАРШРУТЫ (без authMiddleware, без CSRF) ============
app.use('/api/auth', authLimiter, authRoutes);
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ============ CSRF ТОКЕН ДЛЯ ФРОНТЕНДА ============
// Этот маршрут генерирует и отправляет CSRF токен
app.get('/api/csrf-token', csrfProtection, csrfTokenHandler, (req: Request, res: Response) => {
  const token = (req as any).csrfToken?.() || null;
  res.json({ csrfToken: token });
});

// ============ ЗАЩИЩЕННЫЕ МАРШРУТЫ ============
// Сначала проверяем аутентификацию
app.use(authMiddleware);

// Потом проверяем CSRF (только для не-GET запросов)
app.use(csrfValidate);

// Затем логируем
app.use(auditLog);

// API с лимитерами
app.use('/api/products', apiLimiter, productRoutes);
app.use('/api/categories', apiLimiter, categoryRoutes);
app.use('/api/sales', apiLimiter, saleRoutes);
app.use('/api/reports', apiLimiter, reportRoutes);
app.use('/api/sale-documents', apiLimiter, saleDocumentRoutes);
app.use('/api/clients', apiLimiter, clientRoutes);
app.use('/api/audit', apiLimiter, auditRoutes);

// Обработка ошибки CSRF
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF token validation failed:', err.message);
    res.status(403).json({ error: 'Неверный CSRF токен' });
    return;
  }
  next(err);
});

// Обработка 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Обработка ошибок
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT: number = parseInt(process.env.PORT || '5000', 10);
const HOST: string = '0.0.0.0';

const getLocalIPs = () => {
  const interfaces: { [key: string]: string[] } = {};
  const networkInterfaces = os.networkInterfaces();
  
  for (const [name, ifaces] of Object.entries(networkInterfaces)) {
    if (!ifaces) continue;
    interfaces[name] = [];
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        interfaces[name].push(iface.address);
      }
    }
  }
  return interfaces;
};

app.listen(PORT, HOST, () => {
  console.log('\n🚀 CRM Backend Server Started\n');
  console.log('📍 Доступные адреса:');
  console.log(`   📱 Локальный:    http://localhost:${PORT}`);
  
  console.log('\n🔍 Все сетевые интерфейсы:');
  const ips = getLocalIPs();
  for (const [name, addresses] of Object.entries(ips)) {
    for (const address of addresses) {
      console.log(`   ${name}: ${address}`);
      console.log(`   🌐 http://${address}:${PORT}`);
    }
  }
  console.log('\n✅ Сервер готов к работе!\n');
  console.log('🔒 Безопасность включена:');
  console.log('   - HttpOnly Cookies');
  console.log('   - CSRF Protection');
  console.log('   - Rate Limiting');
  console.log('   - Helmet.js');
  console.log('   - CORS ограничен');
  
  logRateLimitStatus();
});
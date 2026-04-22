import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fixSequences } from './utils/fixSequences';

// Импорт middleware безопасности
import { globalLimiter, authLimiter, apiLimiter } from './middleware/rateLimit.middleware';
import { csrfProtection } from './middleware/csrf.middleware';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// ============ 1. НАСТРОЙКА TRUST PROXY ============
app.set('trust proxy', 1);

// ============ 2. HELMET ============
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// ============ 3. CORS ============
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://swapcrm38.ru',
  'https://www.swapcrm38.ru'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin && process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin as string)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Cookie', 'Authorization', 'X-CSRF-Token', 'XSRF-Token', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400,
}));

// ============ 4. СЖАТИЕ ============
app.use(compression({
  level: 6,
  threshold: 1024,
}));

// ============ 5. ПАРСИНГ ТЕЛА ============
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// ============ 6. ГЛОБАЛЬНЫЙ RATE LIMITING ============
app.use(globalLimiter);

// ============ 7. ТАЙМАУТЫ ============
app.use((req: Request, res: Response, next: NextFunction) => {
  req.setTimeout(30000, () => {
    res.status(504).json({ error: 'Request timeout' });
  });
  res.setTimeout(30000, () => {
    res.status(504).json({ error: 'Response timeout' });
  });
  next();
});

// ============ 8. ЛОГИРОВАНИЕ ============
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`📝 ${req.method} ${req.url}`);
    next();
  });
}

// ============ ПОДКЛЮЧАЕМ МАРШРУТЫ ============
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

// ============ ПУБЛИЧНЫЕ МАРШРУТЫ ============
app.use('/api/auth', authLimiter, authRoutes);
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ============ РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ (ФОТО) ============
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============ ЗАЩИЩЕННЫЕ МАРШРУТЫ (с аутентификацией) ============
// Приводим middleware к нужному типу с помощью 'as any' для обхода конфликта типов
app.use('/api/products', authMiddleware as any, csrfProtection as any, auditLog as any, apiLimiter, productRoutes);
app.use('/api/categories', authMiddleware as any, csrfProtection as any, auditLog as any, apiLimiter, categoryRoutes);
app.use('/api/sales', authMiddleware as any, csrfProtection as any, auditLog as any, apiLimiter, saleRoutes);
app.use('/api/reports', authMiddleware as any, csrfProtection as any, auditLog as any, apiLimiter, reportRoutes);
app.use('/api/sale-documents', authMiddleware as any, csrfProtection as any, auditLog as any, apiLimiter, saleDocumentRoutes);
app.use('/api/clients', authMiddleware as any, csrfProtection as any, auditLog as any, apiLimiter, clientRoutes);
app.use('/api/audit', authMiddleware as any, csrfProtection as any, auditLog as any, apiLimiter, auditRoutes);

// ============ ОБРАБОТКА 404 ============
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ============ ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК ============
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Server error:', err.message);
  
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'CORS not allowed' });
    return;
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV !== 'production' ? err.message : undefined
  });
});

// ============ ЗАПУСК СЕРВЕРА ============
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

async function startServer() {
  await fixSequences();
  
  app.listen(PORT, HOST, () => {
    console.log('\n🚀 CRM Backend Server Started\n');
    console.log(`📍 Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📍 Порт: ${PORT}`);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n📍 Доступные адреса:');
      console.log(`   📱 Локальный:    http://localhost:${PORT}`);
      
      const ips = getLocalIPs();
      for (const [name, addresses] of Object.entries(ips)) {
        for (const address of addresses) {
          console.log(`   ${name}: http://${address}:${PORT}`);
        }
      }
    }
    
    console.log('\n✅ Сервер готов к работе!\n');
    console.log('🔒 Безопасность включена:');
    console.log('   - HttpOnly Cookies');
    console.log('   - Helmet.js');
    console.log('   - CORS ограничен');
    console.log('   - Rate limiting');
    console.log('   - CSRF защита');
    console.log('   - Compression');
    console.log('   - Timeouts\n');
  });
}

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing server...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer().catch((error) => {
  console.error('❌ Ошибка при запуске сервера:', error);
  process.exit(1);
});

export { app };
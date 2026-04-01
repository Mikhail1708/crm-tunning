// backend/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const app = express();

// Настройка CORS для доступа из любой сети
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

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

// Публичные маршруты (не требуют аутентификации)
app.use('/api/auth', authRoutes);
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware аутентификации (применяется ко всем защищенным маршрутам)
app.use(authMiddleware);
app.use(auditLog);

// Защищенные маршруты (требуют аутентификации)
app.use('/api/audit', auditRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sale-documents', saleDocumentRoutes);
app.use('/api/clients', clientRoutes);

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

// Функция для получения IP адресов
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
  
  // Показываем все сетевые интерфейсы
  console.log('\n🔍 Все сетевые интерфейсы:');
  const ips = getLocalIPs();
  for (const [name, addresses] of Object.entries(ips)) {
    for (const address of addresses) {
      console.log(`   ${name}: ${address}`);
      console.log(`   🌐 http://${address}:${PORT}`);
    }
  }
  console.log('\n✅ Сервер готов к работе!\n');
});
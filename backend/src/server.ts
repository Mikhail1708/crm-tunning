// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/products.routes';
import categoryRoutes from './routes/categories.routes';
import saleDocumentRoutes from './routes/saleDocuments.routes';
import clientRoutes from './routes/clients.routes';
import auditRoutes from './routes/audit.routes';
import reportsRoutes from './routes/reports.routes'; // 🆕 ДОБАВИТЬ reports
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// CORS настройки
app.use(cors({ 
  origin: ['https://swapcrm38.ru', 'http://localhost:5173', 'http://127.0.0.1:5173'], 
  credentials: true 
}));

app.use(express.json({limit:'100mb'}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// CSRF токен - отдаем и проверяем
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf-token', token, { httpOnly: false, secure: true, sameSite: 'lax' });
  res.json({ csrfToken: token });
});

// CSRF проверка (кроме GET/HEAD/OPTIONS)
app.use((req, res, next) => {
  const csrfToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies['csrf-token'];
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
  }
  next();
});

// Роуты
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sale-documents', saleDocumentRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportsRoutes); // 🆕 ДОБАВИТЬ reports РОУТ

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.listen(5000, '0.0.0.0', () => console.log('Server running on port 5000 with CSRF enabled'));
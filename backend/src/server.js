// backend/src/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const os = require('os');

dotenv.config();

const app = express();

// Настройка CORS для доступа из любой сети
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Подключаем маршруты
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/products.routes');
const categoryRoutes = require('./routes/categories.routes');
const saleRoutes = require('./routes/sales.routes');
const reportRoutes = require('./routes/reports.routes');
const saleDocumentRoutes = require('./routes/saleDocuments.routes');
const clientRoutes = require('./routes/clients.routes');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sale-documents', saleDocumentRoutes);
app.use('/api/clients', clientRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('\n🚀 CRM Backend Server Started\n');
  console.log('📍 Доступные адреса:');
  console.log(`   📱 Локальный:    http://localhost:${PORT}`);
  console.log(`   🌐 Локальная сеть: http://192.168.2.27:${PORT}`);
  console.log(`   🌍 Интернет:     http://10.50.85.247:${PORT}`);
  
  // Показываем все сетевые интерфейсы
  console.log('\n🔍 Все сетевые интерфейсы:');
  const networkInterfaces = os.networkInterfaces();
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   ${name}: ${iface.address}`);
      }
    }
  }
  console.log('\n✅ Сервер готов к работе!\n');
});
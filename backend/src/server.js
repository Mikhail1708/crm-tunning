const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/products.routes');
const saleRoutes = require('./routes/sales.routes');
const reportRoutes = require('./routes/reports.routes');
const categoryRoutes = require('./routes/categories.routes'); // Добавляем категории
const saleDocumentsRoutes = require('./routes/saleDocuments.routes');
const clientRoutes = require('./routes/clients.routes')
app.use('/api/sale-documents', saleDocumentsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/categories', categoryRoutes); // Добавляем маршрут для категорий
app.use('/api/clients', clientRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Сервер работает', timestamp: new Date() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}`);
  console.log(`🔐 Health: http://localhost:${PORT}/api/health`);
});
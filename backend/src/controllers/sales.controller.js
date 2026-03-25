const { PrismaClient } = require('@prisma/client');
const { validateSale } = require('../utils/validation');

const prisma = new PrismaClient();

const createSale = async (req, res) => {
  try {
    const { productId, quantity, selling_price, customer_name, customer_phone } = req.body;
    
    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    
    const errors = validateSale({ quantity, selling_price }, product);
    if (errors.length > 0) return res.status(400).json({ errors });
    
    const total_cost = quantity * product.cost_price;
    const total_revenue = quantity * parseFloat(selling_price);
    const profit = total_revenue - total_cost;
    
    const [sale] = await prisma.$transaction([
      prisma.sale.create({
        data: { productId: parseInt(productId), quantity, selling_price: parseFloat(selling_price), total_cost, total_revenue, profit, customer_name, customer_phone },
        include: { product: true }
      }),
      prisma.product.update({ where: { id: parseInt(productId) }, data: { stock: product.stock - quantity } })
    ]);
    
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка создания продажи' });
  }
};

const getAllSales = async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;
    const where = {};
    if (startDate || endDate) where.sale_date = {};
    if (startDate) where.sale_date.gte = new Date(startDate);
    if (endDate) where.sale_date.lte = new Date(endDate);
    if (productId) where.productId = parseInt(productId);
    
    const sales = await prisma.sale.findMany({
      where, include: { product: true }, orderBy: { sale_date: 'desc' }
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения продаж' });
  }
};

const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id: parseInt(id) }, include: { product: true } });
    if (!sale) return res.status(404).json({ error: 'Продажа не найдена' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения продажи' });
  }
};

const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id: parseInt(id) }, include: { product: true } });
    if (!sale) return res.status(404).json({ error: 'Продажа не найдена' });
    
    await prisma.$transaction([
      prisma.product.update({ where: { id: sale.productId }, data: { stock: sale.product.stock + sale.quantity } }),
      prisma.sale.delete({ where: { id: parseInt(id) } })
    ]);
    res.json({ message: 'Продажа удалена, товар возвращен на склад' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления продажи' });
  }
};

module.exports = { createSale, getAllSales, getSaleById, deleteSale };
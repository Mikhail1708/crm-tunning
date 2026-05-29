// backend/src/controllers/sales.controller.ts
import { Response } from 'express';
import { PrismaClient, Product } from '@prisma/client';
import { RequestWithUser, CreateSaleDTO } from '../types';
import { validateSale, SaleData } from '../utils/validation';

const prisma = new PrismaClient();

export const createSale = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { productId, quantity, selling_price, customer_name, customer_phone }: CreateSaleDTO = req.body;
    
    const product = await prisma.product.findUnique({ 
      where: { id: Number(productId) } 
    });
    
    if (!product) {
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }
    
    const saleData: SaleData = { quantity, selling_price: Number(selling_price) };
    const errors = validateSale(saleData, product);
    
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }
    
    const total_cost = quantity * product.cost_price;
    const total_revenue = quantity * Number(selling_price);
    const profit = total_revenue - total_cost;
    
    const [sale] = await prisma.$transaction([
      prisma.sale.create({
        data: {
          productId: Number(productId),
          quantity,
          selling_price: Number(selling_price),
          total_cost,
          total_revenue,
          profit,
          customer_name,
          customer_phone
        },
        include: { product: true }
      }),
      prisma.product.update({
        where: { id: Number(productId) },
        data: { stock: product.stock - quantity }
      })
    ]);
    
    res.status(201).json(sale);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Ошибка создания продажи' });
  }
};

export const getAllSales = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, productId } = req.query;
    const where: any = {};
    
    if (startDate || endDate) where.sale_date = {};
    if (startDate) where.sale_date.gte = new Date(startDate as string);
    if (endDate) where.sale_date.lte = new Date(endDate as string);
    if (productId) where.productId = Number(productId);
    
    const sales = await prisma.sale.findMany({
      where,
      include: { product: true },
      orderBy: { sale_date: 'desc' }
    });
    
    res.json(sales);
  } catch (error) {
    console.error('Error getting sales:', error);
    res.status(500).json({ error: 'Ошибка получения продаж' });
  }
};

export const getSaleById = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { product: true }
    });
    
    if (!sale) {
      res.status(404).json({ error: 'Продажа не найдена' });
      return;
    }
    
    res.json(sale);
  } catch (error) {
    console.error('Error getting sale:', error);
    res.status(500).json({ error: 'Ошибка получения продажи' });
  }
};

export const deleteSale = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { product: true }
    });
    
    if (!sale) {
      res.status(404).json({ error: 'Продажа не найдена' });
      return;
    }
    
    await prisma.$transaction([
      prisma.product.update({
        where: { id: sale.productId },
        data: { stock: sale.product.stock + sale.quantity }
      }),
      prisma.sale.delete({
        where: { id: Number(id) }
      })
    ]);
    
    res.json({ message: 'Продажа удалена, товар возвращен на склад' });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({ error: 'Ошибка удаления продажи' });
  }
};
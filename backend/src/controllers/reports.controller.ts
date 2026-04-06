// backend/src/controllers/reports.controller.ts
import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser, CreateExpenseDTO, SalesStats, ProductProfitReport } from '../types';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export const getSummary = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    // Получаем только оплаченные заказы
    const paidOrders = await prisma.saleDocument.findMany({
      where: {
        paymentStatus: 'paid',
        documentType: 'order'
      },
      include: {
        items: true
      }
    });
    
    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
    const totalCost = paidOrders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + ((item.cost_price || 0) * item.quantity), 0), 0
    );
    const totalProfit = totalRevenue - totalCost;
    
    const productsCount = await prisma.product.count();
    const lowStockCount = await prisma.product.count({
      where: {
        stock: { lte: prisma.product.fields.min_stock }
      }
    });
    
    const clientsCount = await prisma.client.count();
    
    // Топ товаров по продажам (только из оплаченных заказов)
    const paidOrderIds = paidOrders.map(o => o.id);
    
    let topProducts: any[] = [];
    
    if (paidOrderIds.length > 0) {
      const itemsGrouped = await prisma.saleDocumentItem.groupBy({
        by: ['productId'],
        where: {
          documentId: { in: paidOrderIds }
        },
        _sum: {
          quantity: true,
          total: true
        },
        orderBy: {
          _sum: {
            total: 'desc'
          }
        },
        take: 5
      });
      
      topProducts = await Promise.all(
        itemsGrouped.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { id: true, name: true, article: true, retail_price: true, cost_price: true }
          });
          const totalCost = (product?.cost_price || 0) * (item._sum.quantity || 0);
          return {
            ...product,
            total_sold: item._sum.quantity || 0,
            total_revenue: item._sum.total || 0,
            total_cost: totalCost,
            total_profit: (item._sum.total || 0) - totalCost
          };
        })
      );
    }
    
    res.json({
      total: {
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalProfit,
        margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
      },
      products: {
        total: productsCount,
        low_stock: lowStockCount
      },
      clients: {
        total: clientsCount
      },
      top_products: topProducts
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};

/**
 * GET /api/reports/profit-chart
 * Получить данные для графика (только оплаченные заказы)
 */
export const getProfitChart = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { period = 'month', limit = '12' } = req.query;
    
    const sales = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${period}, sd."saleDate") as period,
        SUM(sd.total) as revenue,
        SUM(sdi."cost_price" * sdi.quantity) as cost,
        SUM(sd.total - (sdi."cost_price" * sdi.quantity)) as profit,
        COUNT(DISTINCT sd.id) as sales_count
      FROM "SaleDocument" sd
      LEFT JOIN "SaleDocumentItem" sdi ON sd.id = sdi."documentId"
      WHERE sd."paymentStatus" = 'paid'
        AND sd."documentType" = 'order'
      GROUP BY DATE_TRUNC(${period}, sd."saleDate")
      ORDER BY period DESC
      LIMIT ${parseInt(limit as string)}
    `;
    res.json(sales);
  } catch (error) {
    console.error('Get profit chart error:', error);
    res.status(500).json({ error: 'Ошибка получения данных для графика' });
  }
};

/**
 * GET /api/reports/profit-by-product
 * Получить прибыль по товарам (только оплаченные заказы)
 */
export const getProfitByProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    // Получаем оплаченные заказы
    const paidOrders = await prisma.saleDocument.findMany({
      where: {
        paymentStatus: 'paid',
        documentType: 'order'
      },
      select: { id: true }
    });
    
    const paidOrderIds = paidOrders.map(o => o.id);
    
    // Получаем все товары
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        article: true,
        cost_price: true,
        retail_price: true,
        stock: true,
        min_stock: true,
        categories: {
          include: {
            category: true
          }
        }
      }
    });
    
    if (paidOrderIds.length === 0) {
      const emptyReport: ProductProfitReport[] = products.map(p => ({
        id: p.id,
        name: p.name,
        article: p.article,
        cost_price: p.cost_price,
        retail_price: p.retail_price,
        stock: p.stock,
        min_stock: p.min_stock,
        total_sold: 0,
        total_revenue: 0,
        total_cost: 0,
        total_profit: 0,
        margin_percent: 0,
        category: p.categories[0]?.category?.name || ''
      }));
      res.json(emptyReport);
      return;
    }
    
    // Получаем данные по товарам из оплаченных заказов
    const items = await prisma.saleDocumentItem.groupBy({
      by: ['productId'],
      where: {
        documentId: { in: paidOrderIds }
      },
      _sum: {
        quantity: true,
        total: true
      }
    });
    
    const report: ProductProfitReport[] = products.map(product => {
      const item = items.find(i => i.productId === product.id);
      const total_sold = item?._sum.quantity || 0;
      const total_revenue = item?._sum.total || 0;
      const total_cost = product.cost_price * total_sold;
      const total_profit = total_revenue - total_cost;
      const margin_percent = total_cost > 0 ? (total_profit / total_cost) * 100 : 0;
      
      return {
        id: product.id,
        name: product.name,
        article: product.article,
        cost_price: product.cost_price,
        retail_price: product.retail_price,
        stock: product.stock,
        min_stock: product.min_stock,
        category: product.categories[0]?.category?.name || '',
        total_sold,
        total_revenue,
        total_cost,
        total_profit,
        margin_percent
      };
    });
    
    // Сортируем по прибыли
    report.sort((a, b) => b.total_profit - a.total_profit);
    
    res.json(report);
  } catch (error) {
    console.error('Get profit by product error:', error);
    res.json([]);
  }
};

/**
 * GET /api/reports/expenses
 * Получить расходы
 */
export const getExpenses = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const where: any = {};
    
    if (startDate || endDate) {
      where.expense_date = {};
      if (startDate) where.expense_date.gte = new Date(startDate as string);
      if (endDate) where.expense_date.lte = new Date(endDate as string);
    }
    
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { expense_date: 'desc' }
    });
    
    const totalByCategory = await prisma.expense.groupBy({
      by: ['category'],
      _sum: {
        amount: true
      }
    });
    
    res.json({
      expenses,
      summary: {
        total: expenses.reduce((sum, e) => sum + e.amount, 0),
        by_category: totalByCategory
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Ошибка получения расходов' });
  }
};

/**
 * POST /api/reports/expenses
 * Добавить расход
 */
export const createExpense = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const data: CreateExpenseDTO = req.body;
    const { name, amount, category, description, expense_date } = data;
    
    const expense = await prisma.expense.create({
      data: {
        name,
        amount: parseFloat(amount as any),
        category,
        description,
        expense_date: expense_date ? new Date(expense_date) : new Date()
      }
    });
    
    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Ошибка создания расхода' });
  }
};

/**
 * GET /api/reports/orders
 * Получить заказы за период (только оплаченные)
 */
export const getOrdersByPeriod = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {
      documentType: 'order',
      paymentStatus: 'paid'
    };
    
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate as string);
      if (endDate) where.saleDate.lte = new Date(endDate as string);
    }
    
    const orders = await prisma.saleDocument.findMany({
      where,
      include: {
        items: true,
        sales: true,
        client: true
      },
      orderBy: { saleDate: 'desc' }
    });
    
    // Форматируем данные для отчета
    const formattedOrders = orders.map(order => ({
      id: order.id,
      documentNumber: order.documentNumber,
      saleDate: order.saleDate,
      customerName: order.customerName || order.clientName,
      customerPhone: order.customerPhone || order.clientPhone,
      items: order.items.map(item => ({
        name: item.productName,
        article: item.productArticle,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        cost_price: item.cost_price || 0,
        cost_total: (item.cost_price || 0) * item.quantity
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      paymentStatus: order.paymentStatus,
      totalProfit: order.total - order.items.reduce((sum, item) => 
        sum + ((item.cost_price || 0) * item.quantity), 0
      )
    }));
    
    // Общая статистика
    const stats: SalesStats = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
      totalProfit: orders.reduce((sum, o) => 
        sum + (o.total - o.items.reduce((itemSum, item) => 
          itemSum + ((item.cost_price || 0) * item.quantity), 0
        )), 0
      ),
      averageCheck: 0,
      margin: 0
    };
    
    stats.averageCheck = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    stats.margin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
    
    res.json({ orders: formattedOrders, stats });
  } catch (error) {
    console.error('Error getting orders by period:', error);
    res.status(500).json({ message: 'Ошибка загрузки заказов' });
  }
};

/**
 * DELETE /api/reports/sales/all
 * Удалить все продажи (только админ)
 */
export const deleteAllSales = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      // Получаем все продажи
      const sales = await tx.sale.findMany();
      
      // Возвращаем товары на склад
      for (const sale of sales) {
        await tx.product.update({
          where: { id: sale.productId },
          data: { stock: { increment: sale.quantity } }
        });
      }
      
      // Удаляем все документы (каскадно удалятся items и sales)
      await tx.saleDocument.deleteMany();
    });
    
    res.json({ message: 'Вся история продаж очищена, товары возвращены на склад' });
  } catch (error) {
    console.error('Error deleting all sales:', error);
    res.status(500).json({ message: 'Ошибка очистки истории' });
  }
};

/**
 * GET /api/reports/stats/:period
 * Получить статистику за период (день, неделя, месяц) - только оплаченные
 */
export const getSalesStats = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { period } = req.params;
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        const day = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }
    
    const orders = await prisma.saleDocument.findMany({
      where: {
        saleDate: { gte: startDate },
        documentType: 'order',
        paymentStatus: 'paid'
      },
      include: {
        items: {
          include: { product: true }
        }
      }
    });
    
    const stats = {
      period,
      startDate,
      endDate: new Date(),
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
      totalProfit: orders.reduce((sum, o) => 
        sum + (o.total - o.items.reduce((itemSum, item) => 
          itemSum + ((item.product?.cost_price || 0) * item.quantity), 0
        )), 0
      )
    };
    
    const avgCheck = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    const margin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
    
    res.json({ ...stats, averageCheck: avgCheck, margin });
  } catch (error) {
    console.error('Error getting sales stats:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики' });
  }
};

/**
 * GET /api/reports/dump
 * Получить дамп всей базы данных (БЕЗ ID)
 */
export const getDatabaseDump = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    console.log('📦 Создание дампа базы данных...');
    
    const [users, products, categories, categoryFields, productCharacteristics, sales, saleDocuments, saleDocumentItems, expenses, clients] = await Promise.all([
      prisma.user.findMany(),
      prisma.product.findMany({
        include: {
          categories: {
            include: {
              category: true
            }
          },
          characteristics: {
            include: { field: true }
          }
        }
      }),
      prisma.category.findMany({
        include: { fields: true }
      }),
      prisma.categoryField.findMany(),
      prisma.productCharacteristic.findMany(),
      prisma.sale.findMany({
        include: { product: true, document: true }
      }),
      prisma.saleDocument.findMany({
        include: { items: true, sales: true, client: true }
      }),
      prisma.saleDocumentItem.findMany(),
      prisma.expense.findMany(),
      prisma.client.findMany({
        include: { orders: true }
      })
    ]);
    
    const dump = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      data: {
        users: users.map(({ id, ...rest }) => rest),
        products: products.map(({ id, ...rest }) => rest),
        categories: categories.map(({ id, ...rest }) => rest),
        categoryFields: categoryFields.map(({ id, ...rest }) => rest),
        productCharacteristics: productCharacteristics.map(({ id, ...rest }) => rest),
        sales: sales.map(({ id, ...rest }) => rest),
        saleDocuments: saleDocuments.map(({ id, ...rest }) => rest),
        saleDocumentItems: saleDocumentItems.map(({ id, ...rest }) => rest),
        expenses: expenses.map(({ id, ...rest }) => rest),
        clients: clients.map(({ id, ...rest }) => rest)
      }
    };
    
    // Сохраняем в файл
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(dump, null, 2), 'utf-8');
    
    console.log(`✅ Дамп сохранен: ${filepath}`);
    console.log(`✅ Экспорт базы данных завершен`);
    res.json(dump);
  } catch (error) {
    console.error('Error creating database dump:', error);
    res.status(500).json({ message: 'Ошибка создания дампа базы данных' });
  }
};

/**
 * POST /api/reports/restore
 * Восстановление базы данных из дампа (ПОЛНОСТЬЮ ПЕРЕРАБОТАНО)
 */
export const restoreDatabase = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    const dump = req.body;
    
    if (!dump || !dump.data) {
      res.status(400).json({ message: 'Неверный формат дампа' });
      return;
    }
    
    console.log('🔄 Начинаем восстановление базы данных...');
    
    // Выполняем восстановление в транзакции
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // ==================== ШАГ 1: ОЧИСТКА БД ====================
      console.log('🗑️ Очистка базы данных...');
      
      // Удаляем элементы документов
      await tx.saleDocumentItem.deleteMany();
      console.log('  - saleDocumentItems удалены');
      
      // Удаляем продажи
      await tx.sale.deleteMany();
      console.log('  - sales удалены');
      
      // Удаляем документы продаж
      await tx.saleDocument.deleteMany();
      console.log('  - saleDocuments удалены');
      
      // Удаляем характеристики товаров
      await tx.productCharacteristic.deleteMany();
      console.log('  - productCharacteristics удалены');
      
      // Удаляем расходы
      await tx.expense.deleteMany();
      console.log('  - expenses удалены');
      
      // Удаляем клиентов
      await tx.client.deleteMany();
      console.log('  - clients удалены');
      
      // Удаляем связи товаров с категориями
      try {
        await tx.$executeRaw`TRUNCATE TABLE "ProductCategory" RESTART IDENTITY CASCADE;`;
      } catch (error) {
        console.log('  - ProductCategory удалены (или таблица не существует)');
      }
      
      // Удаляем товары
      await tx.product.deleteMany();
      console.log('  - products удалены');
      
      // Удаляем поля категорий
      await tx.categoryField.deleteMany();
      console.log('  - categoryFields удалены');
      
      // Удаляем категории
      await tx.category.deleteMany();
      console.log('  - categories удалены');
      
      // Удаляем не-админ пользователей
      await tx.user.deleteMany({
        where: {
          role: { not: 'admin' }
        }
      });
      console.log('  - non-admin users удалены');
      
      console.log('✅ Очистка завершена');
      
      // ==================== ШАГ 2: ВОССТАНОВЛЕНИЕ ====================
      console.log('📥 Восстановление данных...');
      
      // Маппы для соответствия старых ID новым
      const categoryIdMap = new Map<number, number>();
      const fieldIdMap = new Map<number, number>();
      const productIdMap = new Map<number, number>();
      const clientIdMap = new Map<number, number>();
      const documentIdMap = new Map<number, number>();
      
      // 2.1 Восстанавливаем категории
      if (dump.data.categories && dump.data.categories.length > 0) {
        for (const category of dump.data.categories) {
          const oldId = category.id;
          const { id, products, fields, ...categoryData } = category;
          const newCategory = await tx.category.create({
            data: categoryData
          });
          categoryIdMap.set(oldId, newCategory.id);
        }
        console.log(`  ✅ Восстановлено ${dump.data.categories.length} категорий`);
      }
      
      // 2.2 Восстанавливаем поля категорий
      if (dump.data.categoryFields && dump.data.categoryFields.length > 0) {
        for (const field of dump.data.categoryFields) {
          const oldId = field.id;
          const { id, values, categoryId, ...fieldData } = field;
          const newCategoryId = categoryIdMap.get(categoryId);
          if (newCategoryId) {
            const newField = await tx.categoryField.create({
              data: {
                ...fieldData,
                categoryId: newCategoryId
              }
            });
            fieldIdMap.set(oldId, newField.id);
          }
        }
        console.log(`  ✅ Восстановлено ${dump.data.categoryFields.length} полей категорий`);
      }
      
      // 2.3 Восстанавливаем товары
      if (dump.data.products && dump.data.products.length > 0) {
        for (const product of dump.data.products) {
          const oldId = product.id;
          const { id, categories, characteristics, sales, saleDocumentItems, productCategory, category, categoryId, ...productData } = product;
          
          if (!productData.costBreakdown) {
            productData.costBreakdown = [];
          }
          
          const newProduct = await tx.product.create({
            data: productData
          });
          productIdMap.set(oldId, newProduct.id);
        }
        console.log(`  ✅ Восстановлено ${dump.data.products.length} товаров`);
        
        // Восстанавливаем связи товаров с категориями
        for (const product of dump.data.products) {
          const newProductId = productIdMap.get(product.id);
          if (!newProductId) continue;
          
          // Связи из product.categories
          if (product.categories && Array.isArray(product.categories)) {
            for (const pc of product.categories) {
              const catId = pc.categoryId || pc.category?.id;
              if (catId && categoryIdMap.has(catId)) {
                try {
                  await tx.$executeRaw`
                    INSERT INTO "ProductCategory" ("productId", "categoryId")
                    VALUES (${newProductId}, ${categoryIdMap.get(catId)})
                    ON CONFLICT DO NOTHING
                  `;
                } catch (error) {
                  console.log(`    ⚠️ Не удалось добавить связь товара ${newProductId} с категорией ${catId}`);
                }
              }
            }
          }
          
          // Связи из categoryId (старая структура)
          if (product.categoryId && categoryIdMap.has(product.categoryId)) {
            try {
              await tx.$executeRaw`
                INSERT INTO "ProductCategory" ("productId", "categoryId")
                VALUES (${newProductId}, ${categoryIdMap.get(product.categoryId)})
                ON CONFLICT DO NOTHING
              `;
            } catch (error) {
              console.log(`    ⚠️ Не удалось добавить связь товара ${newProductId} с категорией ${product.categoryId}`);
            }
          }
        }
        console.log(`  ✅ Восстановлены связи товаров с категориями`);
      }
      
      // 2.4 Восстанавливаем характеристики товаров
      if (dump.data.productCharacteristics && dump.data.productCharacteristics.length > 0) {
        let restored = 0;
        for (const char of dump.data.productCharacteristics) {
          const { id, productId, fieldId, ...charData } = char;
          const newProductId = productIdMap.get(productId);
          const newFieldId = fieldIdMap.get(fieldId);
          
          if (newProductId && newFieldId) {
            await tx.productCharacteristic.create({
              data: {
                ...charData,
                productId: newProductId,
                fieldId: newFieldId
              }
            });
            restored++;
          }
        }
        console.log(`  ✅ Восстановлено ${restored} характеристик`);
      }
      
      // 2.5 Восстанавливаем клиентов
      if (dump.data.clients && dump.data.clients.length > 0) {
        for (const client of dump.data.clients) {
          const oldId = client.id;
          const { id, orders, ...clientData } = client;
          const newClient = await tx.client.create({
            data: clientData
          });
          clientIdMap.set(oldId, newClient.id);
        }
        console.log(`  ✅ Восстановлено ${dump.data.clients.length} клиентов`);
      }
      
      // 2.6 Восстанавливаем документы продаж
      if (dump.data.saleDocuments && dump.data.saleDocuments.length > 0) {
        for (const doc of dump.data.saleDocuments) {
          const oldId = doc.id;
          const { id, items, sales, client, ...docData } = doc;
          
          const cleanDocData: any = { ...docData };
          
          // Устанавливаем clientId если есть
          if (doc.clientId && clientIdMap.has(doc.clientId)) {
            cleanDocData.clientId = clientIdMap.get(doc.clientId);
          } else if (doc.client?.id && clientIdMap.has(doc.client.id)) {
            cleanDocData.clientId = clientIdMap.get(doc.client.id);
          }
          
          const newDoc = await tx.saleDocument.create({
            data: cleanDocData
          });
          documentIdMap.set(oldId, newDoc.id);
        }
        console.log(`  ✅ Восстановлено ${dump.data.saleDocuments.length} документов`);
      }
      
      // 2.7 Восстанавливаем элементы документов
      if (dump.data.saleDocumentItems && dump.data.saleDocumentItems.length > 0) {
        let restored = 0;
        for (const item of dump.data.saleDocumentItems) {
          const { id, documentId, productId, ...itemData } = item;
          const newDocumentId = documentIdMap.get(documentId);
          const newProductId = productIdMap.get(productId);
          
          if (newDocumentId && newProductId) {
            await tx.saleDocumentItem.create({
              data: {
                ...itemData,
                documentId: newDocumentId,
                productId: newProductId
              }
            });
            restored++;
          }
        }
        console.log(`  ✅ Восстановлено ${restored} элементов документов`);
      }
      
      // 2.8 Восстанавливаем продажи
      if (dump.data.sales && dump.data.sales.length > 0) {
        let restored = 0;
        for (const sale of dump.data.sales) {
          const { id, product, document, ...saleData } = sale;
          const newProductId = productIdMap.get(sale.productId);
          
          if (!newProductId) {
            continue;
          }
          
          const dataToCreate: any = { ...saleData };
          dataToCreate.productId = newProductId;
          
          if (sale.documentId && documentIdMap.has(sale.documentId)) {
            dataToCreate.documentId = documentIdMap.get(sale.documentId);
          }
          
          delete dataToCreate.id;
          
          try {
            await tx.sale.create({ data: dataToCreate });
            restored++;
          } catch (err) {
            console.log(`    ⚠️ Ошибка при создании продажи:`, err);
          }
        }
        console.log(`  ✅ Восстановлено ${restored} продаж`);
      }
      
      // 2.9 Восстанавливаем расходы
      if (dump.data.expenses && dump.data.expenses.length > 0) {
        for (const expense of dump.data.expenses) {
          const { id, ...expenseData } = expense;
          await tx.expense.create({ data: expenseData });
        }
        console.log(`  ✅ Восстановлено ${dump.data.expenses.length} расходов`);
      }
      
      // 2.10 Восстанавливаем пользователей (не админов)
      if (dump.data.users && dump.data.users.length > 0) {
        let restored = 0;
        for (const user of dump.data.users) {
          if (user.role !== 'admin') {
            const { id, ...userData } = user;
            const existingUser = await tx.user.findUnique({
              where: { email: userData.email }
            });
            if (!existingUser) {
              await tx.user.create({ data: userData });
              restored++;
            }
          }
        }
        console.log(`  ✅ Восстановлено ${restored} пользователей`);
      }
    });
    
    console.log('✅ Восстановление базы данных завершено успешно!');
    res.json({ 
      success: true,
      message: 'База данных успешно восстановлена из дампа',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error restoring database:', error);
    res.status(500).json({ 
      message: `Ошибка восстановления базы данных: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
};

/**
 * DELETE /api/reports/database/clear
 * Полная очистка базы данных (только админ)
 */
export const clearDatabase = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.saleDocumentItem.deleteMany();
      await tx.sale.deleteMany();
      await tx.saleDocument.deleteMany();
      await tx.productCharacteristic.deleteMany();
      await tx.expense.deleteMany();
      await tx.client.deleteMany();
      
      try {
        await tx.$executeRaw`TRUNCATE TABLE "ProductCategory" RESTART IDENTITY CASCADE;`;
      } catch (error) {
        console.log('ProductCategory table may not exist, skipping...');
      }
      
      await tx.product.deleteMany();
      await tx.categoryField.deleteMany();
      await tx.category.deleteMany();
      
      await tx.user.deleteMany({
        where: {
          role: { not: 'admin' }
        }
      });
    });
    
    res.json({ message: 'База данных полностью очищена' });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ message: 'Ошибка очистки базы данных' });
  }
};
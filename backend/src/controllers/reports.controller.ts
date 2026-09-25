// backend/src/controllers/reports.controller.ts
import { Response } from 'express';
import { BackupError, exportDatabaseBackup, restoreDatabaseBackup, lockBackupTables, clearBackupTables, assertSalesHistoryCanBeCleared } from '../services/databaseBackup.service';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser, CreateExpenseDTO, SalesStats, ProductProfitReport } from '../types';
import fs from 'fs';
import path from 'path';
import { parsePagination } from '../utils/pagination';
import { paidOrderTotals } from '../services/reportAggregates.service';
import { paidSaleWhere, paidSaleSql } from '../utils/saleFinancialEligibility';

const prisma = new PrismaClient();

// Интерфейс для старого формата дампа
interface OldDump {
  exportedAt?: string;
  version?: string;
  data: {
    users?: any[];
    products?: any[];
    categories?: any[];
    categoryFields?: any[];
    productCharacteristics?: any[];
    sales?: any[];
    saleDocuments?: any[];
    saleDocumentItems?: any[];
    expenses?: any[];
    clients?: any[];
  };
}

// Интерфейс для нового формата дампа
interface NewDump {
  exportedAt: string;
  version: string;
  data: {
    users: any[];
    products: any[];
    categories: any[];
    categoryFields: any[];
    productCharacteristics: any[];
    sales: any[];
    saleDocuments: any[];
    saleDocumentItems: any[];
    expenses: any[];
    clients: any[];
    productCategories: Array<{ productId: number; categoryId: number }>;
  };
}

/**
 * Конвертирует старый формат дампа (1.0) в новый (3.0)
 */
const convertDumpToV3 = (oldDump: OldDump): NewDump => {
  console.log('🔄 Конвертация дампа из версии 1.0 в 3.0...');
  
  const newDump: NewDump = {
    exportedAt: oldDump.exportedAt || new Date().toISOString(),
    version: '3.0',
    data: {
      users: [],
      products: [],
      categories: [],
      categoryFields: [],
      productCharacteristics: [],
      sales: [],
      saleDocuments: [],
      saleDocumentItems: [],
      expenses: [],
      clients: [],
      productCategories: []
    }
  };

  // Конвертируем пользователей
  if (oldDump.data?.users && oldDump.data.users.length > 0) {
    newDump.data.users = oldDump.data.users.map((user: any, index: number) => ({
      id: index + 1,
      email: user.email,
      password: user.password,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString()
    }));
  }

  // Конвертируем категории
  if (oldDump.data?.categories && oldDump.data.categories.length > 0) {
    newDump.data.categories = oldDump.data.categories.map((cat: any, index: number) => ({
      id: index + 1,
      name: cat.name,
      description: cat.description || '',
      createdAt: cat.createdAt || new Date().toISOString(),
      updatedAt: cat.updatedAt || new Date().toISOString()
    }));
  }

  // Конвертируем поля категорий
  if (oldDump.data?.categoryFields && oldDump.data.categoryFields.length > 0) {
    newDump.data.categoryFields = oldDump.data.categoryFields.map((field: any, index: number) => {
      const category = newDump.data.categories.find((c: any) => c.name === field.categoryName);
      return {
        id: index + 1,
        categoryId: category ? category.id : 1,
        name: field.name,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        options: field.options,
        createdAt: field.createdAt || new Date().toISOString(),
        updatedAt: field.updatedAt || new Date().toISOString()
      };
    });
  }

  // Конвертируем товары
  if (oldDump.data?.products && oldDump.data.products.length > 0) {
    newDump.data.products = oldDump.data.products.map((product: any, index: number) => ({
      id: index + 1,
      name: product.name,
      article: product.article || '',
      cost_price: product.cost_price || 0,
      retail_price: product.retail_price || 0,
      description: product.description || '',
      stock: product.stock || 0,
      min_stock: product.min_stock || 1,
      costBreakdown: product.costBreakdown || [],
      createdAt: product.createdAt || new Date().toISOString(),
      updatedAt: product.updatedAt || new Date().toISOString()
    }));

    // Создаем связи ProductCategory
    oldDump.data.products.forEach((product: any, index: number) => {
      if (product.categories && product.categories.length > 0) {
        const productId = index + 1;
        const category = newDump.data.categories.find((c: any) => c.name === product.categories[0]?.category?.name);
        if (category) {
          newDump.data.productCategories.push({
            productId: productId,
            categoryId: category.id
          });
        }
      }
    });
  }

  // Конвертируем характеристики
  if (oldDump.data?.productCharacteristics && oldDump.data.productCharacteristics.length > 0) {
    newDump.data.productCharacteristics = oldDump.data.productCharacteristics.map((char: any, index: number) => {
      const product = newDump.data.products.find((p: any) => p.name === char.productName);
      const field = newDump.data.categoryFields.find((f: any) => f.name === char.fieldName);
      
      return {
        id: index + 1,
        productId: product ? product.id : 1,
        fieldId: field ? field.id : 1,
        value: char.value,
        createdAt: char.createdAt || new Date().toISOString(),
        updatedAt: char.updatedAt || new Date().toISOString()
      };
    });
  }

  // Конвертируем клиентов
  if (oldDump.data?.clients && oldDump.data.clients.length > 0) {
    newDump.data.clients = oldDump.data.clients.map((client: any, index: number) => ({
      id: index + 1,
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      middleName: client.middleName || '',
      phone: client.phone || '',
      email: client.email || null,
      city: client.city || null,
      carModel: client.carModel || null,
      carNumber: client.carNumber || null,
      carYear: client.carYear || null,
      createdAt: client.createdAt || new Date().toISOString(),
      updatedAt: client.updatedAt || new Date().toISOString()
    }));
  }

  // Конвертируем документы продаж
  if (oldDump.data?.saleDocuments && oldDump.data.saleDocuments.length > 0) {
    newDump.data.saleDocuments = oldDump.data.saleDocuments.map((doc: any, index: number) => {
      const client = newDump.data.clients.find((c: any) => 
        c.lastName === doc.clientName?.split(' ')[0]
      );
      
      return {
        id: index + 1,
        documentNumber: doc.documentNumber,
        documentType: doc.documentType,
        customerName: doc.customerName,
        customerPhone: doc.customerPhone,
        customerEmail: doc.customerEmail || null,
        customerAddress: doc.customerAddress || null,
        subtotal: doc.subtotal || 0,
        discount: doc.discount || 0,
        total: doc.total || 0,
        paymentMethod: doc.paymentMethod || 'cash',
        paymentStatus: doc.paymentStatus || 'unpaid',
        saleDate: doc.saleDate || new Date().toISOString(),
        clientId: client ? client.id : null,
        createdBy: null,
        createdAt: doc.createdAt || new Date().toISOString(),
        updatedAt: doc.updatedAt || new Date().toISOString()
      };
    });
  }

  // Конвертируем элементы документов
  if (oldDump.data?.saleDocumentItems && oldDump.data.saleDocumentItems.length > 0) {
    newDump.data.saleDocumentItems = oldDump.data.saleDocumentItems.map((item: any, index: number) => {
      const document = newDump.data.saleDocuments.find((d: any) => d.documentNumber === item.documentNumber);
      const product = newDump.data.products.find((p: any) => p.name === item.productName);
      
      return {
        id: index + 1,
        documentId: document ? document.id : 1,
        productId: product ? product.id : 1,
        productName: item.productName,
        productArticle: item.productArticle || '',
        quantity: item.quantity || 1,
        price: item.price || 0,
        total: item.total || 0,
        cost_price: item.cost_price || 0,
        createdAt: item.createdAt || new Date().toISOString()
      };
    });
  }

  // Конвертируем продажи
  if (oldDump.data?.sales && oldDump.data.sales.length > 0) {
    newDump.data.sales = oldDump.data.sales.map((sale: any, index: number) => {
      const document = newDump.data.saleDocuments.find((d: any) => d.documentNumber === sale.documentNumber);
      
      return {
        id: index + 1,
        productId: sale.productId || 1,
        quantity: sale.quantity || 1,
        selling_price: sale.selling_price || 0,
        total_cost: sale.total_cost || 0,
        total_revenue: sale.total_revenue || 0,
        profit: sale.profit || 0,
        customer_name: sale.customer_name,
        customer_phone: sale.customer_phone,
        sale_date: sale.sale_date || new Date().toISOString(),
        documentId: document ? document.id : null,
        createdAt: sale.createdAt || new Date().toISOString()
      };
    });
  }

  // Конвертируем расходы
  if (oldDump.data?.expenses && oldDump.data.expenses.length > 0) {
    newDump.data.expenses = oldDump.data.expenses.map((exp: any, index: number) => ({
      id: index + 1,
      name: exp.name,
      amount: exp.amount,
      category: exp.category,
      description: exp.description,
      expense_date: exp.expense_date || new Date().toISOString(),
      createdAt: exp.createdAt || new Date().toISOString()
    }));
  }

  console.log('✅ Конвертация завершена');
  return newDump;
};

export const getSummary = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const totals = await paidOrderTotals(prisma);
    const totalRevenue = totals.revenue;
    const totalCost = totals.cost;
    const totalProfit = totalRevenue - totalCost;
    
    const productsCount = await prisma.product.count();
    const lowStockCount = await prisma.product.count({
      where: {
        stock: { lte: prisma.product.fields.min_stock }
      }
    });
    
    const clientsCount = await prisma.client.count();
    
    let topProducts: any[] = [];
    
    if (totals.count > 0) {
      const itemsGrouped = await prisma.$queryRaw<Array<{ productId: number; sold: number; revenue: number; cost: number }>>`
        SELECT i."productId", SUM(i.quantity)::double precision AS sold,
          SUM(i.total) AS revenue, SUM(i.cost_price * i.quantity) AS cost
        FROM "SaleDocumentItem" i JOIN "SaleDocument" d ON d.id = i."documentId"
        WHERE ${paidSaleSql('d')} AND d."documentType" = 'order'
        GROUP BY i."productId" ORDER BY revenue DESC, i."productId" ASC LIMIT 5
      `;

      topProducts = await Promise.all(
        itemsGrouped.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { id: true, name: true, article: true, retail_price: true, cost_price: true }
          });
          const totalCost = item.cost;
          return {
            ...product,
            total_sold: item.sold,
            total_revenue: item.revenue,
            total_cost: totalCost,
            total_profit: (item.revenue) - totalCost
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

export const getProfitChart = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const requestedPeriod = req.query.period;
    const period = typeof requestedPeriod === 'string' && ['day', 'week', 'month', 'year'].includes(requestedPeriod)
      ? requestedPeriod : 'month';
    const { limit } = parsePagination(1, req.query.limit, 12, 120);
    
    // Select occupied periods first; aggregate item cost before joining it to documents.
    const sales = await prisma.$queryRaw`
      WITH RECURSIVE periods(period, n) AS (
        SELECT DATE_TRUNC(${period}, MAX("saleDate")), 1
        FROM "SaleDocument" WHERE ${paidSaleSql()} AND "documentType" = 'order'
        UNION ALL
        SELECT next_period.period, p.n + 1 FROM periods p
        CROSS JOIN LATERAL (
          SELECT DATE_TRUNC(${period}, MAX("saleDate")) AS period FROM "SaleDocument"
          WHERE ${paidSaleSql()} AND "documentType" = 'order' AND "saleDate" < p.period
        ) next_period
        WHERE p.n < ${limit} AND next_period.period IS NOT NULL
      ), selected_documents AS (
        SELECT sd.id, sd.total, sd."saleDate"
        FROM "SaleDocument" sd
        JOIN periods p ON p.period = DATE_TRUNC(${period}, sd."saleDate")
        WHERE ${paidSaleSql('sd')} AND sd."documentType" = 'order'
      ), item_costs AS (
        SELECT i."documentId", SUM(i.cost_price * i.quantity) AS cost
        FROM "SaleDocumentItem" i JOIN selected_documents sd ON sd.id = i."documentId"
        GROUP BY i."documentId"
      )
      SELECT
        DATE_TRUNC(${period}, sd."saleDate") as period,
        SUM(sd.total) as revenue,
        SUM(COALESCE(ic.cost, 0)) as cost,
        SUM(sd.total - COALESCE(ic.cost, 0)) as profit,
        COUNT(*)::double precision as sales_count
      FROM selected_documents sd
      LEFT JOIN item_costs ic ON ic."documentId" = sd.id
      GROUP BY 1
      ORDER BY period DESC
      LIMIT ${limit}
    `;
    res.json(sales);
  } catch (error) {
    console.error('Get profit chart error:', error);
    res.status(500).json({ error: 'Ошибка получения данных для графика' });
  }
};

export const getProfitByProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit, 50, 200);
    const [result] = await prisma.$queryRaw<Array<{ rows: unknown[]; total: number }>>`
      WITH grouped AS (
        SELECT i."productId", SUM(i.quantity) AS sold, SUM(i.total) AS revenue, SUM(i.cost_price * i.quantity) AS cost
        FROM "SaleDocumentItem" i JOIN "SaleDocument" d ON d.id = i."documentId"
        WHERE ${paidSaleSql('d')} AND d."documentType" = 'order' GROUP BY i."productId"
      ), report AS (
        SELECT p.id, p.name, p.article, p.cost_price, p.retail_price, p.stock, p.min_stock,
          COALESCE((SELECT c.name FROM "ProductCategory" pc JOIN "Category" c ON c.id = pc."categoryId"
            WHERE pc."productId" = p.id ORDER BY pc."categoryId" LIMIT 1), '') AS category,
          COALESCE(g.sold, 0)::double precision AS total_sold, COALESCE(g.revenue, 0) AS total_revenue,
          COALESCE(g.cost, 0) AS total_cost
        FROM "Product" p LEFT JOIN grouped g ON g."productId" = p.id
      ), calculated AS (
        SELECT *, total_revenue - total_cost AS total_profit,
          CASE WHEN total_revenue > 0 THEN (total_revenue - total_cost) / total_revenue * 100 ELSE 0 END AS margin_percent FROM report
      ), page_rows AS (
        SELECT * FROM calculated ORDER BY total_profit DESC, id ASC LIMIT ${limit} OFFSET ${skip}
      ) SELECT (SELECT COUNT(*)::double precision FROM calculated) AS total,
        COALESCE((SELECT json_agg(page_rows) FROM page_rows), '[]'::json) AS rows
    `;
    res.setHeader('X-Total-Count', String(result.total));
    res.setHeader('X-Page', String(page));
    res.setHeader('X-Limit', String(limit));
    res.json(result.rows);
  } catch (error) {
    console.error('Get profit by product error:', error);
    res.json([]);
  }
};

export const getExpenses = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const where: any = {};
    
    if (startDate || endDate) {
      where.expense_date = {};
      if (startDate) where.expense_date.gte = new Date(startDate as string);
      if (endDate) where.expense_date.lte = new Date(endDate as string);
    }
    
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit, 50, 200);
    const expenses = await prisma.expense.findMany({
      where, take: limit, skip,
      orderBy: [{ expense_date: 'desc' }, { id: 'desc' }]
    });
    const aggregate = await prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true });
    
    const totalByCategory = await prisma.expense.groupBy({
      where,
      by: ['category'],
      _sum: {
        amount: true
      }
    });
    
    res.json({
      expenses, page, limit, total: aggregate._count,
      summary: {
        total: aggregate._sum.amount || 0,
        by_category: totalByCategory
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Ошибка получения расходов' });
  }
};

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

export const getOrdersByPeriod = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {
      documentType: 'order',
      ...paidSaleWhere()
    };
    
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate as string);
      if (endDate) where.saleDate.lte = new Date(endDate as string);
    }
    
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit, 50, 200);
    const totals = await paidOrderTotals(prisma, where.saleDate?.gte, false, where.saleDate?.lte);
    const orders = await prisma.saleDocument.findMany({
      where, take: limit, skip,
      include: {
        items: true
      },
      orderBy: [{ saleDate: 'desc' }, { id: 'desc' }]
    });
    
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
    
    const stats: SalesStats = {
      totalOrders: totals.count,
      totalRevenue: totals.revenue,
      totalProfit: totals.revenue - totals.cost,
      averageCheck: 0,
      margin: 0
    };
    
    stats.averageCheck = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    stats.margin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
    
    res.json({ orders: formattedOrders, stats, page, limit, total: totals.count });
  } catch (error) {
    console.error('Error getting orders by period:', error);
    res.status(500).json({ message: 'Ошибка загрузки заказов' });
  }
};

export const deleteAllSales = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      await lockBackupTables(tx);
      await assertSalesHistoryCanBeCleared(tx);
      const sales = await tx.sale.findMany();
      
      for (const sale of sales) {
        await tx.product.update({
          where: { id: sale.productId },
          data: { stock: { increment: sale.quantity } }
        });
      }
      
      await tx.sale.deleteMany();
      await tx.saleDocument.deleteMany();
    });
    
    res.json({ message: 'Вся история продаж очищена, товары возвращены на склад' });
  } catch (error) {
    if (error instanceof BackupError) { res.status(error.status).json({ message: error.message }); return; }
    console.error('Error deleting all sales:', error);
    res.status(500).json({ message: 'Ошибка очистки истории' });
  }
};

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
    
    const totals = await paidOrderTotals(prisma, startDate, true);
    const stats = {
      period, startDate, endDate: new Date(),
      totalOrders: totals.count,
      totalRevenue: totals.revenue,
      totalProfit: totals.revenue - totals.cost
    };

    const avgCheck = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    const margin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
    
    res.json({ ...stats, averageCheck: avgCheck, margin });
  } catch (error) {
    console.error('Error getting sales stats:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики' });
  }
};

export const getDatabaseDump = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    console.log('📦 Создание дампа базы данных...');
    
    const dump = await exportDatabaseBackup(prisma);
    
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(dump, null, 2), 'utf-8');
    
    console.log(`✅ Дамп сохранен: ${filepath}`);
    
    // Отправляем JSON клиенту
    res.json(dump);
  } catch (error) {
    console.error('Error creating database dump:', error);
    res.status(500).json({ message: 'Ошибка создания дампа базы данных' });
  }
};

export const restoreDatabase = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') { res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' }); return; }
    let dump = req.body;
    if (dump?.data && (!dump.version || dump.version === '1.0')) {
      dump = { ...convertDumpToV3(dump), legacyRuntimePolicy: dump.legacyRuntimePolicy };
    }
    await restoreDatabaseBackup(prisma, dump);
    res.json({ success: true, message: 'База данных успешно восстановлена из дампа', timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof BackupError) { res.status(error.status).json({ message: error.message }); return; }
    console.error('Database restore failed');
    res.status(500).json({ message: 'Ошибка восстановления базы данных' });
  }
};

export const clearDatabase = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') { res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' }); return; }
    await prisma.$transaction(async tx => {
      await lockBackupTables(tx);
      await clearBackupTables(tx);
    }, { timeout: 120_000 });
    res.json({ message: 'База данных полностью очищена' });
  } catch (error) {
    console.error('Database clear failed');
    res.status(500).json({ message: 'Ошибка очистки базы данных' });
  }
};

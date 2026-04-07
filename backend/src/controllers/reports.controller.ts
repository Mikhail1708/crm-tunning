// backend/src/controllers/reports.controller.ts
import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser, CreateExpenseDTO, SalesStats, ProductProfitReport } from '../types';
import fs from 'fs';
import path from 'path';

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

export const getProfitByProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const paidOrders = await prisma.saleDocument.findMany({
      where: {
        paymentStatus: 'paid',
        documentType: 'order'
      },
      select: { id: true }
    });
    
    const paidOrderIds = paidOrders.map(o => o.id);
    
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
    
    report.sort((a, b) => b.total_profit - a.total_profit);
    res.json(report);
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

export const deleteAllSales = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      const sales = await tx.sale.findMany();
      
      for (const sale of sales) {
        await tx.product.update({
          where: { id: sale.productId },
          data: { stock: { increment: sale.quantity } }
        });
      }
      
      await tx.saleDocument.deleteMany();
    });
    
    res.json({ message: 'Вся история продаж очищена, товары возвращены на склад' });
  } catch (error) {
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

export const getDatabaseDump = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    console.log('📦 Создание дампа базы данных...');
    
    const [users, products, categories, categoryFields, productCharacteristics, sales, saleDocuments, saleDocumentItems, expenses, clients] = await Promise.all([
      prisma.user.findMany(),
      prisma.product.findMany(),
      prisma.category.findMany(),
      prisma.categoryField.findMany(),
      prisma.productCharacteristic.findMany(),
      prisma.sale.findMany(),
      prisma.saleDocument.findMany(),
      prisma.saleDocumentItem.findMany(),
      prisma.expense.findMany(),
      prisma.client.findMany()
    ]);
    
    const productCategories = await prisma.$queryRaw<any[]>`
      SELECT "productId", "categoryId" FROM "ProductCategory"
    `;
    
    const dump = {
      exportedAt: new Date().toISOString(),
      version: '3.0',
      data: {
        users,
        products,
        categories,
        categoryFields,
        productCharacteristics,
        sales,
        saleDocuments,
        saleDocumentItems,
        expenses,
        clients,
        productCategories
      }
    };
    
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(dump, null, 2), 'utf-8');
    
    console.log(`✅ Дамп сохранен: ${filepath}`);
    res.json(dump);
  } catch (error) {
    console.error('Error creating database dump:', error);
    res.status(500).json({ message: 'Ошибка создания дампа базы данных' });
  }
};

// backend/src/controllers/reports.controller.ts
// (первые функции getSummary, getProfitChart и т.д. остаются без изменений)

export const restoreDatabase = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    let dump = req.body;
    
    console.log('📥 Получен запрос на восстановление');
    console.log('  - Версия дампа:', dump?.version);
    
    if (!dump.version || dump.version === '1.0') {
      console.log('⚠️ Обнаружена старая версия дампа, конвертируем...');
      dump = convertDumpToV3(dump);
    }
    
    if (!dump || !dump.data) {
      res.status(400).json({ message: 'Неверный формат дампа' });
      return;
    }
    
    if (dump.version !== '3.0') {
      res.status(400).json({ 
        message: `Неподдерживаемая версия дампа (${dump.version}). Ожидается версия 3.0.` 
      });
      return;
    }
    
    console.log('🔄 Начинаем восстановление БД...');
    
    try {
      await prisma.$transaction(async (tx) => {
        console.log('🗑️ Очистка базы данных...');
        
        // Очищаем в правильном порядке
        await tx.saleDocumentItem.deleteMany();
        await tx.sale.deleteMany();
        await tx.productCharacteristic.deleteMany();
        await tx.$executeRaw`DELETE FROM "ProductCategory"`;
        await tx.saleDocument.deleteMany();
        await tx.expense.deleteMany();
        await tx.client.deleteMany();
        await tx.product.deleteMany();
        await tx.categoryField.deleteMany();
        await tx.category.deleteMany();
        await tx.user.deleteMany({
          where: { role: { not: 'admin' } }
        });
        
        console.log('✅ Очистка завершена');
        console.log('📥 Восстановление данных...');
        
        // Восстанавливаем пользователей
        for (const user of dump.data.users) {
          if (user.role === 'admin') {
            const existingAdmin = await tx.user.findFirst({ where: { role: 'admin' } });
            if (existingAdmin) continue;
          }
          await tx.user.create({ data: user });
        }
        console.log(`  ✅ Восстановлено ${dump.data.users.length} пользователей`);
        
        // Восстанавливаем категории
        for (const cat of dump.data.categories) {
          await tx.category.create({ data: cat });
        }
        console.log(`  ✅ Восстановлено ${dump.data.categories.length} категорий`);
        
        // Восстанавливаем поля категорий
        for (const field of dump.data.categoryFields) {
          await tx.categoryField.create({ data: field });
        }
        console.log(`  ✅ Восстановлено ${dump.data.categoryFields.length} полей категорий`);
        
        // Восстанавливаем товары
        for (const prod of dump.data.products) {
          await tx.product.create({ data: prod });
        }
        console.log(`  ✅ Восстановлено ${dump.data.products.length} товаров`);
        
        // Восстанавливаем связи товаров с категориями
        for (const pc of dump.data.productCategories) {
          try {
            await tx.$executeRaw`
              INSERT INTO "ProductCategory" ("productId", "categoryId")
              VALUES (${pc.productId}, ${pc.categoryId})
              ON CONFLICT ("productId", "categoryId") DO NOTHING
            `;
          } catch (err) {
            // Игнорируем ошибки дублирования
          }
        }
        console.log(`  ✅ Восстановлено ${dump.data.productCategories.length} связей`);
        
        // Восстанавливаем характеристики (с проверкой дубликатов)
        let characteristicsRestored = 0;
        for (const char of dump.data.productCharacteristics) {
          try {
            // Проверяем, существует ли уже такая комбинация
            const existing = await tx.productCharacteristic.findFirst({
              where: {
                productId: char.productId,
                fieldId: char.fieldId
              }
            });
            
            if (!existing) {
              await tx.productCharacteristic.create({ 
                data: {
                  productId: char.productId,
                  fieldId: char.fieldId,
                  value: char.value,
                  createdAt: char.createdAt || new Date().toISOString(),
                  updatedAt: char.updatedAt || new Date().toISOString()
                }
              });
              characteristicsRestored++;
            }
          } catch (err) {
            // Пропускаем проблемные записи
            console.log(`    ⚠️ Пропущена характеристика: продукт ${char.productId}, поле ${char.fieldId}`);
          }
        }
        console.log(`  ✅ Восстановлено ${characteristicsRestored} из ${dump.data.productCharacteristics.length} характеристик`);
        
        // Восстанавливаем клиентов
        for (const client of dump.data.clients) {
          await tx.client.create({ data: client });
        }
        console.log(`  ✅ Восстановлено ${dump.data.clients.length} клиентов`);
        
        // Восстанавливаем документы
        for (const doc of dump.data.saleDocuments) {
          await tx.saleDocument.create({ data: doc });
        }
        console.log(`  ✅ Восстановлено ${dump.data.saleDocuments.length} документов`);
        
        // Восстанавливаем элементы документов
        for (const item of dump.data.saleDocumentItems) {
          await tx.saleDocumentItem.create({ data: item });
        }
        console.log(`  ✅ Восстановлено ${dump.data.saleDocumentItems.length} элементов`);
        
        // Восстанавливаем продажи
        for (const sale of dump.data.sales) {
          await tx.sale.create({ data: sale });
        }
        console.log(`  ✅ Восстановлено ${dump.data.sales.length} продаж`);
        
        // Восстанавливаем расходы
        for (const exp of dump.data.expenses) {
          await tx.expense.create({ data: exp });
        }
        console.log(`  ✅ Восстановлено ${dump.data.expenses.length} расходов`);
      });
      
      console.log('✅ Восстановление базы данных успешно завершено!');
      res.json({ 
        success: true, 
        message: 'База данных успешно восстановлена из дампа',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Ошибка при восстановлении:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Ошибка восстановления базы данных:', error);
    res.status(500).json({ 
      message: `Ошибка восстановления базы данных: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
};

export const clearDatabase = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    console.log('🗑️ Полная очистка базы данных...');
    
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
    
    console.log('✅ База данных полностью очищена');
    res.json({ message: 'База данных полностью очищена' });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ message: 'Ошибка очистки базы данных' });
  }
};
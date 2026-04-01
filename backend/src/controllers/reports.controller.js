// backend/src/controllers/reports.controller.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Получить общую статистику
const getSummary = async (req, res) => {
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
    const topProducts = await prisma.saleDocumentItem.groupBy({
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
    
    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
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
      top_products: topProductsWithDetails
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};

// Получить данные для графика (только оплаченные заказы)
const getProfitChart = async (req, res) => {
  try {
    const { period = 'month', limit = 12 } = req.query;
    
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
      LIMIT ${parseInt(limit)}
    `;
    res.json(sales);
  } catch (error) {
    console.error('Get profit chart error:', error);
    res.status(500).json({ error: 'Ошибка получения данных для графика' });
  }
};

// Получить прибыль по товарам (только оплаченные заказы)
const getProfitByProduct = async (req, res) => {
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
      const emptyReport = products.map(p => ({
        ...p,
        total_sold: 0,
        total_revenue: 0,
        total_cost: 0,
        total_profit: 0,
        margin_percent: 0,
        category: p.categories[0]?.category?.name || ''
      }));
      return res.json(emptyReport);
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
    
    const report = products.map(product => {
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

// Получить расходы
const getExpenses = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.expense_date = {};
      if (startDate) where.expense_date.gte = new Date(startDate);
      if (endDate) where.expense_date.lte = new Date(endDate);
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

// Добавить расход
const createExpense = async (req, res) => {
  try {
    const { name, amount, category, description, expense_date } = req.body;
    const expense = await prisma.expense.create({
      data: {
        name,
        amount: parseFloat(amount),
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

// Получить заказы за период (только оплаченные)
const getOrdersByPeriod = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {
      documentType: 'order',
      paymentStatus: 'paid'
    };
    
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
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
    const stats = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
      totalDiscount: orders.reduce((sum, o) => sum + (o.discount || 0), 0),
      totalCost: orders.reduce((sum, o) => 
        sum + o.items.reduce((itemSum, item) => 
          itemSum + ((item.cost_price || 0) * item.quantity), 0
        ), 0
      ),
      totalProfit: orders.reduce((sum, o) => 
        sum + (o.total - o.items.reduce((itemSum, item) => 
          itemSum + ((item.cost_price || 0) * item.quantity), 0
        )), 0
      )
    };
    
    stats.averageCheck = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    stats.margin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
    
    res.json({ orders: formattedOrders, stats });
  } catch (error) {
    console.error('Error getting orders by period:', error);
    res.status(500).json({ message: 'Ошибка загрузки заказов' });
  }
};

// Удалить все продажи
const deleteAllSales = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
    }
    
    await prisma.$transaction(async (prisma) => {
      // Получаем все продажи
      const sales = await prisma.sale.findMany();
      
      // Возвращаем товары на склад
      for (const sale of sales) {
        await prisma.product.update({
          where: { id: sale.productId },
          data: { stock: { increment: sale.quantity } }
        });
      }
      
      // Удаляем все документы (каскадно удалятся items и sales)
      await prisma.saleDocument.deleteMany();
    });
    
    res.json({ message: 'Вся история продаж очищена, товары возвращены на склад' });
  } catch (error) {
    console.error('Error deleting all sales:', error);
    res.status(500).json({ message: 'Ошибка очистки истории' });
  }
};

// Получить статистику за период (день, неделя, месяц) - только оплаченные
const getSalesStats = async (req, res) => {
  try {
    const { period } = req.params;
    const now = new Date();
    let startDate;
    
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
    
    stats.averageCheck = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    stats.margin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting sales stats:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики' });
  }
};

// Получить дамп всей базы данных (БЕЗ ID)
const getDatabaseDump = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
    }
    
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
          },
          saleDocumentItems: true
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
      version: '1.0',
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
    
    console.log('✅ Экспорт базы данных завершен');
    res.json(dump);
  } catch (error) {
    console.error('Error creating database dump:', error);
    res.status(500).json({ message: 'Ошибка создания дампа базы данных' });
  }
};

// Полная очистка базы данных
const clearDatabase = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
    }
    
    await prisma.$transaction(async (prisma) => {
      await prisma.saleDocumentItem.deleteMany();
      await prisma.sale.deleteMany();
      await prisma.saleDocument.deleteMany();
      await prisma.productCharacteristic.deleteMany();
      await prisma.expense.deleteMany();
      await prisma.client.deleteMany();
      
      try {
        await prisma.productCategory.deleteMany();
      } catch (error) {
        console.log('ProductCategory table may not exist, skipping...');
      }
      
      await prisma.product.deleteMany();
      await prisma.categoryField.deleteMany();
      await prisma.category.deleteMany();
      
      await prisma.user.deleteMany({
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

// Восстановление базы данных из дампа
const restoreDatabase = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
    }
    
    const dump = req.body;
    
    if (!dump || !dump.data) {
      return res.status(400).json({ message: 'Неверный формат дампа' });
    }
    
    console.log('Начинаем восстановление базы данных...');
    
    await prisma.$transaction(async (prisma) => {
      // Очищаем все таблицы
      await prisma.saleDocumentItem.deleteMany();
      await prisma.sale.deleteMany();
      await prisma.saleDocument.deleteMany();
      await prisma.productCharacteristic.deleteMany();
      await prisma.expense.deleteMany();
      await prisma.client.deleteMany();
      
      try {
        await prisma.productCategory.deleteMany();
      } catch (error) {
        console.log('ProductCategory table may not exist, skipping...');
      }
      
      await prisma.product.deleteMany();
      await prisma.categoryField.deleteMany();
      await prisma.category.deleteMany();
      
      await prisma.user.deleteMany({
        where: {
          role: { not: 'admin' }
        }
      });
      
      // Маппы для соответствия ID
      const categoryIdMap = new Map();
      const fieldIdMap = new Map();
      const productIdMap = new Map();
      const clientIdMap = new Map();
      const documentIdMap = new Map();
      
      // Восстанавливаем категории
      if (dump.data.categories && dump.data.categories.length > 0) {
        for (const category of dump.data.categories) {
          const oldId = category.id;
          const { id, products, fields, ...categoryData } = category;
          const newCategory = await prisma.category.create({
            data: categoryData
          });
          categoryIdMap.set(oldId, newCategory.id);
        }
        console.log(`Восстановлено ${dump.data.categories.length} категорий`);
      }
      
      // Восстанавливаем поля категорий
      if (dump.data.categoryFields && dump.data.categoryFields.length > 0) {
        for (const field of dump.data.categoryFields) {
          const { id, values, categoryId, ...fieldData } = field;
          const newCategoryId = categoryIdMap.get(categoryId);
          if (newCategoryId) {
            const newField = await prisma.categoryField.create({
              data: {
                ...fieldData,
                categoryId: newCategoryId
              }
            });
            fieldIdMap.set(id, newField.id);
          }
        }
        console.log(`Восстановлено ${dump.data.categoryFields.length} полей категорий`);
      }
      
      // Восстанавливаем товары
      if (dump.data.products && dump.data.products.length > 0) {
        for (const product of dump.data.products) {
          const oldId = product.id;
          const { 
            id, 
            categories, 
            characteristics, 
            sales, 
            saleDocumentItems,
            productCategory,
            category,
            categoryId,
            ...productData 
          } = product;
          
          if (!productData.costBreakdown) {
            productData.costBreakdown = [];
          }
          
          const newProduct = await prisma.product.create({
            data: productData
          });
          productIdMap.set(oldId, newProduct.id);
          
          // Восстанавливаем связи с категориями
          if (product.categoryId && categoryIdMap.has(product.categoryId)) {
            await prisma.productCategory.create({
              data: {
                productId: newProduct.id,
                categoryId: categoryIdMap.get(product.categoryId)
              }
            });
          }
          
          if (product.categories && Array.isArray(product.categories)) {
            for (const cat of product.categories) {
              const catId = cat.categoryId || cat.id;
              if (categoryIdMap.has(catId)) {
                await prisma.productCategory.create({
                  data: {
                    productId: newProduct.id,
                    categoryId: categoryIdMap.get(catId)
                  }
                });
              }
            }
          }
        }
        console.log(`Восстановлено ${dump.data.products.length} товаров`);
      }
      
      // Восстанавливаем характеристики товаров
      if (dump.data.productCharacteristics && dump.data.productCharacteristics.length > 0) {
        for (const char of dump.data.productCharacteristics) {
          const { id, productId, fieldId, ...charData } = char;
          const newProductId = productIdMap.get(productId);
          const newFieldId = fieldIdMap.get(fieldId);
          
          if (newProductId && newFieldId) {
            await prisma.productCharacteristic.create({
              data: {
                ...charData,
                productId: newProductId,
                fieldId: newFieldId
              }
            });
          }
        }
        console.log(`Восстановлено ${dump.data.productCharacteristics.length} характеристик`);
      }
      
      // Восстанавливаем клиентов
      if (dump.data.clients && dump.data.clients.length > 0) {
        for (const client of dump.data.clients) {
          const oldId = client.id;
          const { id, orders, ...clientData } = client;
          const newClient = await prisma.client.create({
            data: clientData
          });
          clientIdMap.set(oldId, newClient.id);
        }
        console.log(`Восстановлено ${dump.data.clients.length} клиентов`);
      }
      
      // Восстанавливаем документы продаж
      if (dump.data.saleDocuments && dump.data.saleDocuments.length > 0) {
        for (const doc of dump.data.saleDocuments) {
          const oldId = doc.id;
          
          // Создаем чистый объект только с нужными полями
          const cleanDocData = {
            documentNumber: doc.documentNumber,
            documentType: doc.documentType,
            clientName: doc.clientName,
            clientPhone: doc.clientPhone,
            customerName: doc.customerName,
            customerPhone: doc.customerPhone,
            customerEmail: doc.customerEmail,
            customerAddress: doc.customerAddress,
            subtotal: doc.subtotal,
            discount: doc.discount,
            total: doc.total,
            tax: doc.tax,
            paymentMethod: doc.paymentMethod,
            paymentStatus: doc.paymentStatus,
            saleDate: doc.saleDate,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
          };
          
          // Определяем clientId
          let finalClientId = null;
          
          if (doc.clientId && clientIdMap.has(doc.clientId)) {
            finalClientId = clientIdMap.get(doc.clientId);
          } else if (doc.client?.id && clientIdMap.has(doc.client.id)) {
            finalClientId = clientIdMap.get(doc.client.id);
          }
          
          if (finalClientId) {
            cleanDocData.clientId = finalClientId;
          }
          
          const newDoc = await prisma.saleDocument.create({
            data: cleanDocData
          });
          documentIdMap.set(oldId, newDoc.id);
        }
        console.log(`Восстановлено ${dump.data.saleDocuments.length} документов`);
      }
      
      // Восстанавливаем элементы документов
      if (dump.data.saleDocumentItems && dump.data.saleDocumentItems.length > 0) {
        for (const item of dump.data.saleDocumentItems) {
          const { id, documentId, productId, ...itemData } = item;
          const newDocumentId = documentIdMap.get(documentId);
          const newProductId = productIdMap.get(productId);
          
          if (newDocumentId && newProductId) {
            await prisma.saleDocumentItem.create({
              data: {
                ...itemData,
                documentId: newDocumentId,
                productId: newProductId
              }
            });
          }
        }
        console.log(`Восстановлено ${dump.data.saleDocumentItems.length} элементов документов`);
      }
      
      // Восстанавливаем продажи
if (dump.data.sales && dump.data.sales.length > 0) {
  for (const sale of dump.data.sales) {
    // Исключаем все вложенные объекты
    const { 
      id, 
      product,      // исключаем вложенный объект product
      document,     // исключаем вложенный объект document
      ...saleData 
    } = sale;
    
    const newProductId = productIdMap.get(sale.productId);
    const newDocumentId = documentIdMap.get(sale.documentId);
    
    const dataToCreate = { ...saleData };
    if (newProductId) dataToCreate.productId = newProductId;
    if (newDocumentId) dataToCreate.documentId = newDocumentId;
    
    await prisma.sale.create({
      data: dataToCreate
    });
  }
  console.log(`Восстановлено ${dump.data.sales.length} продаж`);
}
      
      // Восстанавливаем расходы
      if (dump.data.expenses && dump.data.expenses.length > 0) {
        for (const expense of dump.data.expenses) {
          const { id, ...expenseData } = expense;
          await prisma.expense.create({
            data: expenseData
          });
        }
        console.log(`Восстановлено ${dump.data.expenses.length} расходов`);
      }
      
      // Восстанавливаем пользователей
      if (dump.data.users && dump.data.users.length > 0) {
        for (const user of dump.data.users) {
          if (user.role !== 'admin') {
            const { id, ...userData } = user;
            const existingUser = await prisma.user.findUnique({
              where: { email: userData.email }
            });
            if (!existingUser) {
              await prisma.user.create({
                data: userData
              });
            }
          }
        }
        console.log(`Восстановлены пользователи (кроме администратора)`);
      }
    });
    
    console.log('✅ Восстановление базы данных завершено успешно!');
    res.json({ message: 'База данных успешно восстановлена из дампа' });
    
  } catch (error) {
    console.error('Error restoring database:', error);
    res.status(500).json({ message: 'Ошибка восстановления базы данных: ' + error.message });
  }
};

module.exports = {
  getSummary,
  getProfitChart,
  getProfitByProduct,
  getExpenses,
  createExpense,
  getOrdersByPeriod,
  deleteAllSales,
  getSalesStats,
  getDatabaseDump,
  restoreDatabase,
  clearDatabase
};
// backend/src/controllers/reports.controller.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Получить общую статистику
const getSummary = async (req, res) => {
  try {
    const totalStats = await prisma.sale.aggregate({
      _sum: {
        total_revenue: true,
        total_cost: true,
        profit: true
      }
    });
    
    const productsCount = await prisma.product.count();
    const lowStockCount = await prisma.product.count({
      where: {
        stock: { lte: prisma.product.fields.min_stock }
      }
    });
    
    // Топ товаров по продажам
    const topProducts = await prisma.sale.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        profit: true,
        total_revenue: true
      },
      orderBy: {
        _sum: {
          profit: 'desc'
        }
      },
      take: 5
    });
    
    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true }
        });
        return {
          ...product,
          total_sold: item._sum.quantity,
          total_profit: item._sum.profit,
          total_revenue: item._sum.total_revenue
        };
      })
    );
    
    res.json({
      total: {
        revenue: totalStats._sum.total_revenue || 0,
        cost: totalStats._sum.total_cost || 0,
        profit: totalStats._sum.profit || 0
      },
      products: {
        total: productsCount,
        low_stock: lowStockCount
      },
      top_products: topProductsWithDetails
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};

// Получить данные для графика
const getProfitChart = async (req, res) => {
  try {
    const { period = 'month', limit = 12 } = req.query;
    
    const sales = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${period}, "sale_date") as period,
        SUM("total_revenue") as revenue,
        SUM("total_cost") as cost,
        SUM(profit) as profit,
        COUNT(*) as sales_count
      FROM "Sale"
      GROUP BY DATE_TRUNC(${period}, "sale_date")
      ORDER BY period DESC
      LIMIT ${parseInt(limit)}
    `;
    res.json(sales);
  } catch (error) {
    console.error('Get profit chart error:', error);
    res.status(500).json({ error: 'Ошибка получения данных для графика' });
  }
};

// Получить прибыль по товарам
const getProfitByProduct = async (req, res) => {
  try {
    // Проверяем, есть ли продажи
    const salesCount = await prisma.sale.count();
    
    if (salesCount === 0) {
      // Если продаж нет, возвращаем товары с нулевыми показателями
      const products = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          article: true,
          cost_price: true,
          retail_price: true,
          stock: true,
          min_stock: true,
          category: true
        }
      });
      
      const emptyReport = products.map(p => ({
        ...p,
        total_sold: 0,
        total_revenue: 0,
        total_cost: 0,
        total_profit: 0,
        margin_percent: 0
      }));
      
      return res.json(emptyReport);
    }
    
    // Используем Prisma ORM вместо raw SQL
    const products = await prisma.product.findMany({
      include: {
        sales: true
      }
    });
    
    const report = products.map(product => {
      const total_sold = product.sales.reduce((sum, sale) => sum + sale.quantity, 0);
      const total_revenue = product.sales.reduce((sum, sale) => sum + sale.total_revenue, 0);
      const total_cost = product.sales.reduce((sum, sale) => sum + sale.total_cost, 0);
      const total_profit = product.sales.reduce((sum, sale) => sum + sale.profit, 0);
      const margin_percent = total_cost > 0 ? (total_profit / total_cost) * 100 : 0;
      
      return {
        id: product.id,
        name: product.name,
        article: product.article,
        cost_price: product.cost_price,
        retail_price: product.retail_price,
        stock: product.stock,
        min_stock: product.min_stock,
        category: product.category,
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
    // Возвращаем пустой массив в случае ошибки
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

// Получить заказы за период
const getOrdersByPeriod = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {
      documentType: 'order'
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

// Получить статистику за период (день, неделя, месяц)
const getSalesStats = async (req, res) => {
  try {
    const { period } = req.params; // day, week, month, year
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
        documentType: 'order'
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

// Получить дамп всей базы данных
const getDatabaseDump = async (req, res) => {
  try {
    // Проверяем права администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
    }
    
    // Получаем все данные из всех таблиц
    const [users, products, categories, categoryFields, productCharacteristics, sales, saleDocuments, saleDocumentItems, expenses, clients] = await Promise.all([
      prisma.user.findMany(),
      prisma.product.findMany({
        include: {
          productCategory: true,
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
      version: '1.0',
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
        clients
      }
    };
    
    res.json(dump);
  } catch (error) {
    console.error('Error creating database dump:', error);
    res.status(500).json({ message: 'Ошибка создания дампа базы данных' });
  }
};

// Полная очистка базы данных
const clearDatabase = async (req, res) => {
  try {
    // Проверяем права администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
    }
    
    await prisma.$transaction(async (prisma) => {
      // Очищаем все таблицы в правильном порядке (сначала дочерние, потом родительские)
      await prisma.saleDocumentItem.deleteMany();
      await prisma.sale.deleteMany();
      await prisma.saleDocument.deleteMany();
      await prisma.productCharacteristic.deleteMany();
      await prisma.expense.deleteMany();
      await prisma.client.deleteMany();
      await prisma.product.deleteMany();
      await prisma.categoryField.deleteMany();
      await prisma.category.deleteMany();
      
      // Оставляем пользователей, но удаляем всех кроме администратора
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
  // backend/src/controllers/reports.controller.js (добавить в конец файла)
};
// Восстановление базы данных из дампа
const restoreDatabase = async (req, res) => {
  try {
    // Проверяем права администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
    }
    
    const dump = req.body;
    
    if (!dump || !dump.data) {
      return res.status(400).json({ message: 'Неверный формат дампа' });
    }
    
    console.log('Начинаем восстановление базы данных...');
    
    await prisma.$transaction(async (prisma) => {
      // Очищаем все таблицы в правильном порядке
      await prisma.saleDocumentItem.deleteMany();
      await prisma.sale.deleteMany();
      await prisma.saleDocument.deleteMany();
      await prisma.productCharacteristic.deleteMany();
      await prisma.expense.deleteMany();
      await prisma.client.deleteMany();
      await prisma.product.deleteMany();
      await prisma.categoryField.deleteMany();
      await prisma.category.deleteMany();
      
      // Удаляем всех пользователей кроме администратора
      await prisma.user.deleteMany({
        where: {
          role: { not: 'admin' }
        }
      });
      
      // Восстанавливаем категории
      if (dump.data.categories && dump.data.categories.length > 0) {
        for (const category of dump.data.categories) {
          await prisma.category.create({
            data: {
              id: category.id,
              name: category.name,
              description: category.description,
              icon: category.icon,
              sortOrder: category.sortOrder,
              isActive: category.isActive,
              createdAt: category.createdAt,
              updatedAt: category.updatedAt
            }
          });
        }
        console.log(`Восстановлено ${dump.data.categories.length} категорий`);
      }
      
      // Восстанавливаем поля категорий
      if (dump.data.categoryFields && dump.data.categoryFields.length > 0) {
        for (const field of dump.data.categoryFields) {
          await prisma.categoryField.create({
            data: {
              id: field.id,
              categoryId: field.categoryId,
              name: field.name,
              fieldType: field.fieldType,
              isRequired: field.isRequired,
              sortOrder: field.sortOrder,
              options: field.options,
              createdAt: field.createdAt,
              updatedAt: field.updatedAt
            }
          });
        }
        console.log(`Восстановлено ${dump.data.categoryFields.length} полей категорий`);
      }
      
      // Восстанавливаем товары
      if (dump.data.products && dump.data.products.length > 0) {
        for (const product of dump.data.products) {
          await prisma.product.create({
            data: {
              id: product.id,
              name: product.name,
              article: product.article,
              categoryId: product.categoryId,
              cost_price: product.cost_price,
              retail_price: product.retail_price,
              description: product.description,
              stock: product.stock,
              min_stock: product.min_stock,
              image_url: product.image_url,
              createdAt: product.createdAt,
              updatedAt: product.updatedAt
            }
          });
        }
        console.log(`Восстановлено ${dump.data.products.length} товаров`);
      }
      
      // Восстанавливаем характеристики товаров
      if (dump.data.productCharacteristics && dump.data.productCharacteristics.length > 0) {
        for (const char of dump.data.productCharacteristics) {
          await prisma.productCharacteristic.create({
            data: {
              id: char.id,
              productId: char.productId,
              fieldId: char.fieldId,
              value: char.value,
              createdAt: char.createdAt,
              updatedAt: char.updatedAt
            }
          });
        }
        console.log(`Восстановлено ${dump.data.productCharacteristics.length} характеристик`);
      }
      
      // Восстанавливаем клиентов
      if (dump.data.clients && dump.data.clients.length > 0) {
        for (const client of dump.data.clients) {
          await prisma.client.create({
            data: {
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              middleName: client.middleName,
              phone: client.phone,
              email: client.email,
              birthDate: client.birthDate,
              address: client.address,
              city: client.city,
              passport: client.passport,
              driverLicense: client.driverLicense,
              carModel: client.carModel,
              carYear: client.carYear,
              carVin: client.carVin,
              carNumber: client.carNumber,
              notes: client.notes,
              totalOrders: client.totalOrders,
              totalSpent: client.totalSpent,
              createdAt: client.createdAt,
              updatedAt: client.updatedAt
            }
          });
        }
        console.log(`Восстановлено ${dump.data.clients.length} клиентов`);
      }
      
      // Восстанавливаем документы продаж
      if (dump.data.saleDocuments && dump.data.saleDocuments.length > 0) {
        for (const doc of dump.data.saleDocuments) {
          await prisma.saleDocument.create({
            data: {
              id: doc.id,
              documentNumber: doc.documentNumber,
              documentType: doc.documentType,
              clientId: doc.clientId,
              clientName: doc.clientName,
              clientPhone: doc.clientPhone,
              customerName: doc.customerName,
              customerPhone: doc.customerPhone,
              customerEmail: doc.customerEmail,
              customerAddress: doc.customerAddress,
              subtotal: doc.subtotal,
              discount: doc.discount,
              total: doc.total,
              tax: doc.tax || 0,
              paymentMethod: doc.paymentMethod,
              paymentStatus: doc.paymentStatus,
              saleDate: doc.saleDate,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            }
          });
        }
        console.log(`Восстановлено ${dump.data.saleDocuments.length} документов`);
      }
      
      // Восстанавливаем элементы документов
      if (dump.data.saleDocumentItems && dump.data.saleDocumentItems.length > 0) {
        for (const item of dump.data.saleDocumentItems) {
          await prisma.saleDocumentItem.create({
            data: {
              id: item.id,
              documentId: item.documentId,
              productId: item.productId,
              productName: item.productName,
              productArticle: item.productArticle,
              quantity: item.quantity,
              price: item.price,
              cost_price: item.cost_price || 0,
              total: item.total,
              createdAt: item.createdAt
            }
          });
        }
        console.log(`Восстановлено ${dump.data.saleDocumentItems.length} элементов документов`);
      }
      
      // Восстанавливаем продажи
      if (dump.data.sales && dump.data.sales.length > 0) {
        for (const sale of dump.data.sales) {
          await prisma.sale.create({
            data: {
              id: sale.id,
              productId: sale.productId,
              quantity: sale.quantity,
              selling_price: sale.selling_price,
              total_cost: sale.total_cost,
              total_revenue: sale.total_revenue,
              profit: sale.profit,
              customer_name: sale.customer_name,
              customer_phone: sale.customer_phone,
              sale_date: sale.sale_date,
              createdAt: sale.createdAt,
              documentId: sale.documentId
            }
          });
        }
        console.log(`Восстановлено ${dump.data.sales.length} продаж`);
      }
      
      // Восстанавливаем расходы
      if (dump.data.expenses && dump.data.expenses.length > 0) {
        for (const expense of dump.data.expenses) {
          await prisma.expense.create({
            data: {
              id: expense.id,
              name: expense.name,
              amount: expense.amount,
              category: expense.category,
              description: expense.description,
              expense_date: expense.expense_date,
              createdAt: expense.createdAt
            }
          });
        }
        console.log(`Восстановлено ${dump.data.expenses.length} расходов`);
      }
      
      // Восстанавливаем пользователей (кроме администратора, чтобы не перезаписывать текущего)
      if (dump.data.users && dump.data.users.length > 0) {
        for (const user of dump.data.users) {
          if (user.role !== 'admin') {
            // Проверяем, существует ли пользователь
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email }
            });
            if (!existingUser) {
              await prisma.user.create({
                data: {
                  id: user.id,
                  email: user.email,
                  password: user.password,
                  name: user.name,
                  role: user.role,
                  createdAt: user.createdAt,
                  updatedAt: user.updatedAt
                }
              });
            }
          }
        }
        console.log(`Восстановлено пользователей`);
      }
    });
    
    console.log('Восстановление базы данных завершено успешно!');
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
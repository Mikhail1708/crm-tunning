// backend/src/controllers/saleDocuments.controller.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Получить все документы
const getSaleDocuments = async (req, res) => {
  try {
    const documents = await prisma.saleDocument.findMany({
      include: {
        items: true,
        client: true, // Включаем данные клиента
        sales: {
          include: {
            product: true
          }
        }
      },
      orderBy: { saleDate: 'desc' }
    });
    res.json(documents);
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов' });
  }
};

// Получить документ по ID
const getSaleDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.saleDocument.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: true,
        client: true, // Включаем данные клиента
        sales: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!document) {
      return res.status(404).json({ message: 'Документ не найден' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ message: 'Ошибка загрузки документа' });
  }
};

// backend/src/controllers/saleDocuments.controller.js

// Создать документ продажи (обновленная версия)
const createSaleDocument = async (req, res) => {
  try {
    const {
      documentType,
      clientId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      items,
      discount,
      paymentMethod,
      paymentStatus
    } = req.body;
    
    let finalClientName = customerName;
    let finalClientPhone = customerPhone;
    let client = null;
    
    if (clientId) {
      client = await prisma.client.findUnique({
        where: { id: clientId }
      });
      
      if (client) {
        finalClientName = [client.lastName, client.firstName, client.middleName]
          .filter(Boolean)
          .join(' ')
          .trim() || client.firstName;
        finalClientPhone = client.phone;
      }
    }
    
    const prefix = documentType === 'receipt' ? 'ЧЕК' : documentType === 'invoice' ? 'СЧЕТ' : 'ЗАКАЗ';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const documentNumber = `${prefix}-${dateStr}-${random}`;
    
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal - (discount || 0);
    
    const result = await prisma.$transaction(async (prisma) => {
      const document = await prisma.saleDocument.create({
        data: {
          documentNumber,
          documentType: documentType || 'order',
          clientId: clientId || null,
          clientName: finalClientName,
          clientPhone: finalClientPhone,
          customerName: customerName || finalClientName,
          customerPhone: customerPhone || finalClientPhone,
          customerEmail,
          customerAddress,
          subtotal,
          discount: discount || 0,
          total,
          paymentMethod,
          paymentStatus: paymentStatus || 'unpaid',
          saleDate: new Date()
        }
      });
      
      const sales = [];
      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });
        
        if (!product) {
          throw new Error(`Товар с ID ${item.productId} не найден`);
        }
        
        if (product.stock < item.quantity) {
          throw new Error(`Недостаточно товара ${product.name} на складе`);
        }
        
        // Сохраняем себестоимость в момент продажи!
        const itemCostPrice = product.cost_price;
        const itemTotalCost = itemCostPrice * item.quantity;
        const itemTotalRevenue = item.price * item.quantity;
        
        await prisma.saleDocumentItem.create({
          data: {
            documentId: document.id,
            productId: item.productId,
            productName: product.name,
            productArticle: product.article || '—',
            quantity: item.quantity,
            price: item.price,
            cost_price: itemCostPrice, // 👈 СОХРАНЯЕМ СЕБЕСТОИМОСТЬ
            total: itemTotalRevenue
          }
        });
        
        const sale = await prisma.sale.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            selling_price: item.price,
            total_cost: itemTotalCost,
            total_revenue: itemTotalRevenue,
            profit: itemTotalRevenue - itemTotalCost,
            customer_name: finalClientName || customerName,
            customer_phone: finalClientPhone || customerPhone,
            documentId: document.id
          }
        });
        
        sales.push(sale);
        
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: product.stock - item.quantity }
        });
      }
      
      if (client && client.id) {
        await prisma.client.update({
          where: { id: client.id },
          data: {
            totalOrders: { increment: 1 },
            totalSpent: { increment: total }
          }
        });
      }
      
      return { document, sales };
    });
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating sale document:', error);
    res.status(500).json({ message: error.message || 'Ошибка создания документа' });
  }
};

// Обновить документ
const updateSaleDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, paymentStatus, clientId } = req.body;
    
    const updateData = { documentType, paymentStatus };
    
    // Если меняется клиент
    if (clientId !== undefined) {
      if (clientId === null) {
        // Убираем связь с клиентом
        updateData.clientId = null;
        updateData.clientName = null;
        updateData.clientPhone = null;
      } else {
        const client = await prisma.client.findUnique({
          where: { id: clientId }
        });
        if (client) {
          updateData.clientId = clientId;
          updateData.clientName = [client.lastName, client.firstName, client.middleName]
            .filter(Boolean)
            .join(' ')
            .trim() || client.firstName;
          updateData.clientPhone = client.phone;
        }
      }
    }
    
    const document = await prisma.saleDocument.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    res.json(document);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Ошибка обновления документа' });
  }
};

// Обновить статус оплаты
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    
    const document = await prisma.saleDocument.update({
      where: { id: parseInt(id) },
      data: { paymentStatus }
    });
    
    res.json(document);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Ошибка обновления статуса' });
  }
};

// Удалить документ
const deleteSaleDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id);
    
    await prisma.$transaction(async (prisma) => {
      // Получаем документ с клиентом
      const document = await prisma.saleDocument.findUnique({
        where: { id: documentId },
        include: { sales: true }
      });
      
      if (!document) {
        throw new Error('Документ не найден');
      }
      
      // Возвращаем товары на склад
      for (const sale of document.sales) {
        await prisma.product.update({
          where: { id: sale.productId },
          data: { stock: { increment: sale.quantity } }
        });
      }
      
      // Обновляем статистику клиента
      if (document.clientId) {
        await prisma.client.update({
          where: { id: document.clientId },
          data: {
            totalOrders: { decrement: 1 },
            totalSpent: { decrement: document.total }
          }
        });
      }
      
      // Удаляем документ (каскадно удалятся items и sales)
      await prisma.saleDocument.delete({
        where: { id: documentId }
      });
    });
    
    res.json({ message: 'Документ удален, товары возвращены на склад' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: error.message || 'Ошибка удаления документа' });
  }
};

// Поиск документов по клиенту
const getDocumentsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const documents = await prisma.saleDocument.findMany({
      where: { clientId: parseInt(clientId) },
      include: {
        items: true,
        sales: true
      },
      orderBy: { saleDate: 'desc' }
    });
    
    res.json(documents);
  } catch (error) {
    console.error('Error getting documents by client:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов клиента' });
  }
};

// Статистика по клиентам
const getClientStatistics = async (req, res) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.phone,
        COUNT(sd.id) as order_count,
        SUM(sd.total) as total_spent,
        MAX(sd.sale_date) as last_order_date
      FROM clients c
      LEFT JOIN sale_documents sd ON c.id = sd.client_id
      GROUP BY c.id, c.first_name, c.last_name, c.phone
      ORDER BY total_spent DESC NULLS LAST
      LIMIT 10
    `;
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting client statistics:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики' });
  }
};

module.exports = {
  getSaleDocuments,
  getSaleDocumentById,
  createSaleDocument,
  updateSaleDocument,
  updatePaymentStatus,
  deleteSaleDocument,
  getDocumentsByClient,
  getClientStatistics
};
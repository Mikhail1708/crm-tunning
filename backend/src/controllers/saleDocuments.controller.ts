// backend/src/controllers/saleDocuments.controller.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RequestWithUser, CreateSaleDocumentDTO } from '../types';

const prisma = new PrismaClient();

// Тип для элемента документа
interface DocumentItem {
  productId: number;
  quantity: number;
  price: number;
}

/**
 * GET /api/sale-documents
 * Получить все документы
 */
export const getSaleDocuments = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const documents = await prisma.saleDocument.findMany({
      include: {
        items: true,
        client: true,
        sales: {
          include: {
            product: true
          }
        }
      },
      orderBy: { saleDate: 'desc' }
    });
    
    // Добавляем информацию о продавце (кто создал)
    const documentsWithSeller = await Promise.all(documents.map(async (doc) => {
      let sellerName = null;
      if (doc.createdBy) {
        const user = await prisma.user.findUnique({
          where: { id: doc.createdBy },
          select: { name: true, email: true }
        });
        sellerName = user?.name || user?.email || null;
      }
      return { ...doc, sellerName };
    }));
    
    res.json(documentsWithSeller);
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов' });
  }
};

/**
 * GET /api/sale-documents/:id
 * Получить документ по ID
 */
export const getSaleDocumentById = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const document = await prisma.saleDocument.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: true,
        client: true,
        sales: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!document) {
      res.status(404).json({ message: 'Документ не найден' });
      return;
    }
    
    // Добавляем информацию о продавце
    let sellerName = null;
    if (document.createdBy) {
      const user = await prisma.user.findUnique({
        where: { id: document.createdBy },
        select: { name: true, email: true }
      });
      sellerName = user?.name || user?.email || null;
    }
    
    res.json({ ...document, sellerName });
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ message: 'Ошибка загрузки документа' });
  }
};

/**
 * POST /api/sale-documents
 * Создать документ продажи (заказ/чек/счет)
 */
export const createSaleDocument = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    // Проверяем авторизацию
    if (!req.user) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    
    const data: CreateSaleDocumentDTO = req.body;
    const {
      documentType,
      clientId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      description,
      items,
      discount = 0,
      paymentMethod,
      paymentStatus = 'unpaid'
    } = data;
    
    // Получаем информацию о текущем пользователе (продавец)
    const sellerId = req.user.id;
    const sellerName = req.user.name || req.user.email;
    
    // Определяем имя и телефон клиента
    let finalClientName = customerName;
    let finalClientPhone = customerPhone;
    let client = null;
    let clientDiscount = 0;
    
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
        clientDiscount = client.discountPercent || 0;  // 🆕 Получаем скидку клиента
      }
    }
    
    // Генерируем номер документа
    const prefix = documentType === 'receipt' ? 'ЧЕК' : documentType === 'invoice' ? 'СЧЕТ' : 'ЗАКАЗ';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const documentNumber = `${prefix}-${dateStr}-${random}`;
    
    // Рассчитываем суммы с учётом скидки клиента
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const clientDiscountAmount = subtotal * (clientDiscount / 100);
    const totalDiscount = discount + clientDiscountAmount;
    const total = subtotal - totalDiscount;
    
    const result = await prisma.$transaction(async (tx) => {
      // Создаем документ с указанием создателя
      const document = await tx.saleDocument.create({
        data: {
          documentNumber,
          documentType: documentType || 'order',
          client: clientId ? { connect: { id: clientId } } : undefined,
          clientName: finalClientName,
          clientPhone: finalClientPhone,
          customerName: customerName || finalClientName,
          customerPhone: customerPhone || finalClientPhone,
          customerEmail,
          customerAddress,
          description: description || null,
          subtotal,
          discount: totalDiscount,  // Сохраняем общую скидку
          total,
          paymentMethod,
          paymentStatus,
          saleDate: new Date(),
          createdBy: sellerId
        }
      });
      
      const sales = [];
      
      // Создаем элементы документа и списываем товары
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });
        
        if (!product) {
          throw new Error(`Товар с ID ${item.productId} не найден`);
        }
        
        if (product.stock < item.quantity) {
          throw new Error(`Недостаточно товара "${product.name}" на складе`);
        }
        
        const itemCostPrice = product.cost_price;
        const itemTotalCost = itemCostPrice * item.quantity;
        const itemTotalRevenue = item.price * item.quantity;
        
        // Создаем элемент документа
        await tx.saleDocumentItem.create({
          data: {
            documentId: document.id,
            productId: item.productId,
            productName: product.name,
            productArticle: product.article || '—',
            quantity: item.quantity,
            price: item.price,
            cost_price: itemCostPrice,
            total: itemTotalRevenue
          }
        });
        
        // Создаем запись о продаже
        const sale = await tx.sale.create({
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
        
        // Списание товара со склада
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: product.stock - item.quantity }
        });
      }
      
      // Обновляем статистику клиента
      if (client && client.id) {
        await tx.client.update({
          where: { id: client.id },
          data: {
            totalOrders: { increment: 1 },
            totalSpent: { increment: total }
          }
        });
      }
      
      return { document, sales, sellerName, clientDiscount, clientDiscountAmount };
    });
    
    // Возвращаем документ с именем продавца и информацией о скидке клиента
    res.status(201).json({
      document: { 
        ...result.document, 
        sellerName: result.sellerName,
        clientDiscount: result.clientDiscount,
        clientDiscountAmount: result.clientDiscountAmount
      },
      sales: result.sales
    });
  } catch (error) {
    console.error('Error creating sale document:', error);
    const message = error instanceof Error ? error.message : 'Ошибка создания документа';
    res.status(500).json({ message });
  }
};

/**
 * PUT /api/sale-documents/:id
 * Обновить документ
 */
export const updateSaleDocument = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      documentType,
      paymentStatus,
      clientId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      description
    } = req.body;
    
    const updateData: any = {
      documentType,
      paymentStatus,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      description: description || null
    };
    
    if (clientId !== undefined) {
      if (clientId === null) {
        updateData.client = { disconnect: true };
        updateData.clientName = null;
        updateData.clientPhone = null;
      } else {
        const client = await prisma.client.findUnique({
          where: { id: clientId }
        });
        if (client) {
          updateData.client = { connect: { id: clientId } };
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

/**
 * PATCH /api/sale-documents/:id/payment-status
 * Обновить статус оплаты
 */
export const updatePaymentStatus = async (req: RequestWithUser, res: Response): Promise<void> => {
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

/**
 * DELETE /api/sale-documents/:id
 * Удалить документ (с возвратом товаров на склад)
 */
export const deleteSaleDocument = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id);
    
    await prisma.$transaction(async (tx) => {
      const document = await tx.saleDocument.findUnique({
        where: { id: documentId },
        include: {
          items: true,
          sales: true,
          client: true
        }
      });
      
      if (!document) {
        throw new Error('Документ не найден');
      }
      
      // Возвращаем товары на склад
      for (const item of document.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }
      
      // Обновляем статистику клиента
      if (document.clientId) {
        await tx.client.update({
          where: { id: document.clientId },
          data: {
            totalOrders: { decrement: 1 },
            totalSpent: { decrement: document.total }
          }
        });
      }
      
      // Удаляем документ (каскадно удалятся items и sales)
      await tx.saleDocument.delete({
        where: { id: documentId }
      });
    });
    
    res.json({ message: 'Документ удален, товары возвращены на склад' });
  } catch (error) {
    console.error('Error deleting document:', error);
    const message = error instanceof Error ? error.message : 'Ошибка удаления документа';
    res.status(500).json({ message });
  }
};

/**
 * GET /api/sale-documents/client/:clientId
 * Получить документы по клиенту
 */
export const getDocumentsByClient = async (req: RequestWithUser, res: Response): Promise<void> => {
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
    
    // Добавляем информацию о продавце
    const documentsWithSeller = await Promise.all(documents.map(async (doc) => {
      let sellerName = null;
      if (doc.createdBy) {
        const user = await prisma.user.findUnique({
          where: { id: doc.createdBy },
          select: { name: true, email: true }
        });
        sellerName = user?.name || user?.email || null;
      }
      return { ...doc, sellerName };
    }));
    
    res.json(documentsWithSeller);
  } catch (error) {
    console.error('Error getting documents by client:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов клиента' });
  }
};

/**
 * GET /api/sale-documents/stats/clients
 * Статистика по клиентам
 */
export const getClientStatistics = async (req: RequestWithUser, res: Response): Promise<void> => {
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
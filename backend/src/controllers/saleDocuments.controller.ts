// backend/src/controllers/saleDocuments.controller.ts
import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser, CreateSaleDocumentDTO } from '../types';

const prisma = new PrismaClient();

// Кэш для товаров (уменьшает количество запросов к БД)
const productCache = new Map<number, { 
  stock: number; 
  cost_price: number; 
  name: string; 
  article: string; 
  timestamp: number 
}>();
const CACHE_TTL = 5000; // 5 секунд

// Кэш для пользователей (продавцов)
const userCache = new Map<number, { name: string; email: string; timestamp: number }>();
const USER_CACHE_TTL = 60000; // 60 секунд

interface DocumentItem {
  productId: number;
  quantity: number;
  price: number;
}

/**
 * Получение товара с кэшем
 */
async function getProductWithCache(productId: number) {
  const cached = productCache.get(productId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, article: true, cost_price: true, stock: true }
  });
  
  if (product) {
    productCache.set(productId, {
      stock: product.stock,
      cost_price: product.cost_price,
      name: product.name,
      article: product.article || '—',
      timestamp: Date.now()
    });
  }
  
  return product;
}

/**
 * Получение пользователя с кэшем
 */
async function getUserWithCache(userId: number) {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached;
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
  });
  
  if (user) {
    userCache.set(userId, {
      name: user.name || user.email,
      email: user.email,
      timestamp: Date.now()
    });
  }
  
  return user;
}

/**
 * GET /api/sale-documents
 * Получить все документы (ОПТИМИЗИРОВАННО)
 * ✅ ИСПРАВЛЕНО: добавлен полный client с city
 */
export const getSaleDocuments = async (req: RequestWithUser, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const documents = await prisma.saleDocument.findMany({
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        clientId: true,
        clientName: true,
        clientPhone: true,
        customerName: true,
        customerPhone: true,
        subtotal: true,
        discount: true,
        total: true,
        paymentStatus: true,
        orderStatus: true,
        saleDate: true,
        createdAt: true,
        createdBy: true,
        sellerName: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productArticle: true,
            quantity: true,
            price: true,
            total: true,
            cost_price: true
          }
        },
<<<<<<< HEAD
        // ✅ ИСПРАВЛЕНО: добавлен полный client с city
=======
>>>>>>> feature/edit-order
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            email: true,
<<<<<<< HEAD
            city: true,        // 👈 ГОРОД
=======
            city: true,
>>>>>>> feature/edit-order
            carModel: true,
            carNumber: true,
            discountPercent: true,
            totalOrders: true,
            totalSpent: true
          }
        }
      },
      orderBy: { saleDate: 'desc' },
      take: 100
    });
    
    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.warn(`⚠️ Slow getSaleDocuments: ${duration}ms`);
    }
    
    res.json(documents);
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов' });
  }
};

/**
 * GET /api/sale-documents/:id
 * Получить документ по ID (ОПТИМИЗИРОВАННО)
 * ✅ ИСПРАВЛЕНО: добавлен полный client с city
 */
export const getSaleDocumentById = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id);
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
    const document = await prisma.saleDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        clientId: true,
        clientName: true,
        clientPhone: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerAddress: true,
        description: true,
        subtotal: true,
        discount: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        orderStatus: true,
        saleDate: true,
        createdAt: true,
        createdBy: true,
        sellerName: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productArticle: true,
            quantity: true,
            price: true,
            cost_price: true,
            total: true
          }
        },
<<<<<<< HEAD
        // ✅ ИСПРАВЛЕНО: добавлен полный client с city
=======
>>>>>>> feature/edit-order
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            email: true,
<<<<<<< HEAD
            city: true,        // 👈 ГОРОД
=======
            city: true,
>>>>>>> feature/edit-order
            carModel: true,
            carNumber: true,
            discountPercent: true,
            totalOrders: true,
            totalSpent: true
          }
        }
      }
    });
    
    if (!document) {
      res.status(404).json({ message: 'Документ не найден' });
      return;
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ message: 'Ошибка загрузки документа' });
  }
};

/**
 * POST /api/sale-documents
 * Создать документ продажи (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
 */
export const createSaleDocument = async (req: RequestWithUser, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    
    const data: CreateSaleDocumentDTO = req.body;
    const {
      documentType = 'order',
      clientId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      description,
      items,
      discount = 0,
      paymentMethod = 'cash',
      paymentStatus = 'unpaid'
    } = data;
    
    if (!items || items.length === 0) {
      res.status(400).json({ message: 'Корзина не может быть пустой' });
      return;
    }
    
    const uniqueProductIds = new Set(items.map(i => i.productId));
    if (uniqueProductIds.size !== items.length) {
      res.status(400).json({ message: 'Обнаружены дубликаты товаров в корзине' });
      return;
    }
    
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, article: true, cost_price: true, stock: true }
    });
    
    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map(p => p.id));
      const missingIds = productIds.filter(id => !foundIds.has(id));
      res.status(404).json({ message: `Товары не найдены: ${missingIds.join(', ')}` });
      return;
    }
    
    const productMap = new Map(products.map(p => [p.id, p]));
    
    let subtotal = 0;
    const itemsWithDetails: Array<{
      productId: number;
      quantity: number;
      price: number;
      product: typeof products[0];
      total: number;
    }> = [];
    
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      
      if (product.stock < item.quantity) {
        res.status(400).json({ 
          message: `Недостаточно товара "${product.name}" на складе. Доступно: ${product.stock}` 
        });
        return;
      }
      
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      
      itemsWithDetails.push({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        product,
        total: itemTotal
      });
    }
    
    let client = null;
    let finalClientName = customerName;
    let finalClientPhone = customerPhone;
    let clientDiscount = 0;
    
    if (clientId) {
      client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { 
          id: true, 
          firstName: true, 
          lastName: true, 
          middleName: true, 
          phone: true, 
          email: true,
          city: true,
          discountPercent: true 
        }
      });
      
      if (client) {
        finalClientName = [client.lastName, client.firstName, client.middleName]
          .filter(Boolean)
          .join(' ')
          .trim() || client.firstName || customerName;
        finalClientPhone = client.phone || customerPhone;
        clientDiscount = client.discountPercent || 0;
      }
    }
    
    const clientDiscountAmount = subtotal * (clientDiscount / 100);
    const totalDiscount = discount + clientDiscountAmount;
    const total = Math.max(0, subtotal - totalDiscount);
    
    const prefix = documentType === 'receipt' ? 'ЧЕК' : documentType === 'invoice' ? 'СЧЕТ' : 'ЗАКАЗ';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const documentNumber = `${prefix}-${dateStr}-${random}`;
    
    const sellerId = req.user.id;
    
    let sellerName = req.user.name || req.user.email;
    if (!req.user.name && req.user.email) {
      const userFromDb = await prisma.user.findUnique({
        where: { id: sellerId },
        select: { name: true, email: true }
      });
      sellerName = userFromDb?.name || userFromDb?.email || 'Менеджер';
    }
    
    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.saleDocument.create({
        data: {
          documentNumber,
          documentType,
          clientId: client?.id || null,
          clientName: finalClientName,
          clientPhone: finalClientPhone,
          customerName: finalClientName,
          customerPhone: finalClientPhone,
          customerEmail,
          customerAddress,
          description: description || null,
          subtotal,
          discount: totalDiscount,
          total,
          paymentMethod,
          paymentStatus,
          saleDate: new Date(),
          createdBy: sellerId,
          sellerName: sellerName,
          orderStatus: 'ordered'
        }
      });
      
      await tx.saleDocumentItem.createMany({
        data: itemsWithDetails.map(item => ({
          documentId: document.id,
          productId: item.productId,
          productName: item.product.name,
          productArticle: item.product.article || '—',
          quantity: item.quantity,
          price: item.price,
          cost_price: item.product.cost_price,
          total: item.total
        }))
      });
      
      await tx.sale.createMany({
        data: itemsWithDetails.map(item => {
          const itemTotalCost = item.product.cost_price * item.quantity;
          const itemTotalRevenue = item.price * item.quantity;
          return {
            productId: item.productId,
            quantity: item.quantity,
            selling_price: item.price,
            total_cost: itemTotalCost,
            total_revenue: itemTotalRevenue,
            profit: itemTotalRevenue - itemTotalCost,
            customer_name: finalClientName,
            customer_phone: finalClientPhone,
            documentId: document.id
          };
        })
      });
      
      const updateCases = itemsWithDetails
        .map(item => `WHEN ${item.productId} THEN stock - ${item.quantity}`)
        .join(' ');
      
      await tx.$executeRaw`
        UPDATE "Product" 
        SET stock = CASE id 
          ${Prisma.raw(updateCases)}
          ELSE stock 
        END
        WHERE id IN (${Prisma.join(productIds)})
      `;
      
      if (client?.id) {
        await tx.client.update({
          where: { id: client.id },
          data: {
            totalOrders: { increment: 1 },
            totalSpent: { increment: total }
          }
        });
      }
      
      return { document, sellerName, clientDiscount, clientDiscountAmount };
    }, {
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });
    
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`⚠️ Slow order creation: ${duration}ms`);
    }
    
    const createdDocument = await prisma.saleDocument.findUnique({
      where: { id: result.document.id },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        clientId: true,
        clientName: true,
        clientPhone: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerAddress: true,
        description: true,
        subtotal: true,
        discount: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        orderStatus: true,
        saleDate: true,
        createdAt: true,
        createdBy: true,
        sellerName: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productArticle: true,
            quantity: true,
            price: true,
            cost_price: true,
            total: true
          }
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            email: true,
            city: true,
            discountPercent: true
          }
        }
      }
    });
    
    res.status(201).json({
      ...createdDocument,
      clientDiscount: result.clientDiscount,
      clientDiscountAmount: result.clientDiscountAmount
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error creating order (${duration}ms):`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('Foreign key')) {
        res.status(400).json({ message: 'Некорректные данные: проверьте ID товаров или клиента' });
        return;
      }
      if (error.message.includes('timeout')) {
        res.status(503).json({ message: 'Сервер перегружен, попробуйте позже' });
        return;
      }
    }
    
    res.status(500).json({ message: error instanceof Error ? error.message : 'Ошибка создания документа' });
  }
};

/**
 * PUT /api/sale-documents/:id
 * Обновить документ
 */
export const updateSaleDocument = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id);
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
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
          where: { id: clientId },
          select: { id: true, firstName: true, lastName: true, middleName: true, phone: true, city: true }
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
      where: { id: documentId },
      data: updateData,
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        paymentStatus: true,
        orderStatus: true,
        sellerName: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            phone: true
          }
        }
      }
    });
    
    res.json(document);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Ошибка обновления документа' });
  }
};

/**
<<<<<<< HEAD
=======
 * PUT /api/sale-documents/:id/full
 * Полное обновление заказа (корзина, скидка, клиент)
 */
export const updateFullOrder = async (req: RequestWithUser, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    
    const { id } = req.params;
    const documentId = parseInt(id);
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
    const { items, discount, description, clientData } = req.body;
    
    // Проверяем существование заказа
    const existingDocument = await prisma.saleDocument.findUnique({
      where: { id: documentId },
      include: { items: true }
    });
    
    if (!existingDocument) {
      res.status(404).json({ message: 'Заказ не найден' });
      return;
    }
    
    if (!items || items.length === 0) {
      res.status(400).json({ message: 'Заказ не может быть пустым' });
      return;
    }
    
    // Получаем актуальные данные о товарах
    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, article: true, cost_price: true, stock: true }
    });
    
    const productMap = new Map(products.map(p => [p.id, p]));
    
    // Проверяем наличие всех товаров
    const missingIds = productIds.filter(id => !productMap.has(id));
    if (missingIds.length > 0) {
      res.status(404).json({ message: `Товары не найдены: ${missingIds.join(', ')}` });
      return;
    }
    
    // Вычисляем новую сумму заказа
    let subtotal = 0;
    const itemsWithDetails = [];
    
    // Создаем карту старых количеств для расчета возврата на склад
    const oldQuantities = new Map<number, number>();
    for (const oldItem of existingDocument.items) {
      oldQuantities.set(oldItem.productId, oldItem.quantity);
    }
    
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      
      const oldQuantity = oldQuantities.get(item.productId) || 0;
      const quantityDelta = item.quantity - oldQuantity;
      
      // Проверяем остатки только если количество увеличилось
      if (quantityDelta > 0 && product.stock < quantityDelta) {
        res.status(400).json({
          message: `Недостаточно товара "${product.name}" на складе. Доступно: ${product.stock}, требуется еще: ${quantityDelta}`
        });
        return;
      }
      
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      
      itemsWithDetails.push({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal,
        product
      });
    }
    
    // Расчет скидки
    const totalDiscount = discount || 0;
    const total = Math.max(0, subtotal - totalDiscount);
    
    // Обновляем или создаем клиента
    let clientId = existingDocument.clientId;
    if (clientData && (clientData.name || clientData.phone)) {
      // Ищем существующего клиента по телефону
      let client = null;
      if (clientData.phone) {
        client = await prisma.client.findFirst({
          where: { phone: clientData.phone }
        });
      }
      
      if (client) {
        clientId = client.id;
        // Обновляем данные клиента
        await prisma.client.update({
          where: { id: client.id },
          data: {
            firstName: clientData.name.split(' ')[1] || clientData.name,
            lastName: clientData.name.split(' ')[0] || '',
            middleName: clientData.name.split(' ')[2] || '',
            phone: clientData.phone,
            email: clientData.email || undefined,
            city: clientData.city || undefined,
          }
        });
      } else if (clientData.name || clientData.phone) {
        // Создаем нового клиента
        const nameParts = clientData.name.split(' ');
        const newClient = await prisma.client.create({
          data: {
            firstName: nameParts[1] || clientData.name,
            lastName: nameParts[0] || '',
            middleName: nameParts[2] || '',
            phone: clientData.phone,
            email: clientData.email || null,
            city: clientData.city || null,
          }
        });
        clientId = newClient.id;
      }
    }
    
    // Обновляем сумму покупок клиента
    const oldTotal = existingDocument.total;
    const totalDelta = total - oldTotal;
    
    // Выполняем обновление в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // 1. Возвращаем старые товары на склад
      for (const oldItem of existingDocument.items) {
        await tx.$executeRaw`
          UPDATE "Product" 
          SET stock = stock + ${oldItem.quantity}
          WHERE id = ${oldItem.productId}
        `;
      }
      
      // 2. Обновляем документ
      const updatedDocument = await tx.saleDocument.update({
        where: { id: documentId },
        data: {
          clientId: clientId,
          clientName: clientData?.name || existingDocument.clientName,
          clientPhone: clientData?.phone || existingDocument.clientPhone,
          customerName: clientData?.name || existingDocument.customerName,
          customerPhone: clientData?.phone || existingDocument.customerPhone,
          customerEmail: clientData?.email || existingDocument.customerEmail,
          customerAddress: clientData?.address || existingDocument.customerAddress,
          subtotal: subtotal,
          discount: totalDiscount,
          total: total,
          description: description !== undefined ? description : existingDocument.description,
        }
      });
      
      // 3. Удаляем старые позиции
      await tx.saleDocumentItem.deleteMany({
        where: { documentId: documentId }
      });
      
      // 4. Создаем новые позиции
      await tx.saleDocumentItem.createMany({
        data: itemsWithDetails.map(item => ({
          documentId: documentId,
          productId: item.productId,
          productName: item.product.name,
          productArticle: item.product.article || '—',
          quantity: item.quantity,
          price: item.price,
          cost_price: item.product.cost_price,
          total: item.total
        }))
      });
      
      // 5. Обновляем склад (списываем новые количества)
      const updateCases = itemsWithDetails
        .map(item => `WHEN ${item.productId} THEN stock - ${item.quantity}`)
        .join(' ');
      
      await tx.$executeRaw`
        UPDATE "Product" 
        SET stock = CASE id 
          ${Prisma.raw(updateCases)}
          ELSE stock 
        END
        WHERE id IN (${Prisma.join(productIds)})
      `;
      
      // 6. Обновляем статистику клиента
      if (clientId) {
        await tx.client.update({
          where: { id: clientId },
          data: {
            totalSpent: { increment: totalDelta }
          }
        });
      } else if (existingDocument.clientId && totalDelta !== 0) {
        await tx.client.update({
          where: { id: existingDocument.clientId },
          data: {
            totalSpent: { increment: totalDelta }
          }
        });
      }
      
      // 7. Обновляем записи в таблице Sale
      await tx.sale.deleteMany({
        where: { documentId: documentId }
      });
      
      await tx.sale.createMany({
        data: itemsWithDetails.map(item => {
          const itemTotalCost = item.product.cost_price * item.quantity;
          const itemTotalRevenue = item.price * item.quantity;
          return {
            productId: item.productId,
            quantity: item.quantity,
            selling_price: item.price,
            total_cost: itemTotalCost,
            total_revenue: itemTotalRevenue,
            profit: itemTotalRevenue - itemTotalCost,
            customer_name: clientData?.name || existingDocument.customerName,
            customer_phone: clientData?.phone || existingDocument.customerPhone,
            documentId: documentId
          };
        })
      });
      
      return updatedDocument;
    }, {
      timeout: 15000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });
    
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`⚠️ Slow order update: ${duration}ms`);
    }
    
    // Получаем обновленный документ с полными данными
    const updatedDocument = await prisma.saleDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        clientId: true,
        clientName: true,
        clientPhone: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerAddress: true,
        description: true,
        subtotal: true,
        discount: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        orderStatus: true,
        saleDate: true,
        createdAt: true,
        createdBy: true,
        sellerName: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productArticle: true,
            quantity: true,
            price: true,
            cost_price: true,
            total: true
          }
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            email: true,
            city: true,
            discountPercent: true
          }
        }
      }
    });
    
    res.json(updatedDocument);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error updating order (${duration}ms):`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('Foreign key')) {
        res.status(400).json({ message: 'Некорректные данные: проверьте ID товаров или клиента' });
        return;
      }
      if (error.message.includes('timeout')) {
        res.status(503).json({ message: 'Сервер перегружен, попробуйте позже' });
        return;
      }
    }
    
    res.status(500).json({ message: error instanceof Error ? error.message : 'Ошибка обновления заказа' });
  }
};

/**
>>>>>>> feature/edit-order
 * PATCH /api/sale-documents/:id/payment-status
 * Обновить статус оплаты
 */
export const updatePaymentStatus = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id);
    const { paymentStatus } = req.body;
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
    const document = await prisma.saleDocument.update({
      where: { id: documentId },
      data: { paymentStatus },
      select: {
        id: true,
        documentNumber: true,
        paymentStatus: true,
        sellerName: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true
          }
        }
      }
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
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      const document = await tx.saleDocument.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          total: true,
          clientId: true,
          items: {
            select: {
              productId: true,
              quantity: true
            }
          }
        }
      });
      
      if (!document) {
        throw new Error('Документ не найден');
      }
      
      if (document.items.length > 0) {
        const updateCases = document.items
          .map(item => `WHEN ${item.productId} THEN stock + ${item.quantity}`)
          .join(' ');
        
        const productIds = document.items.map(i => i.productId);
        
        await tx.$executeRaw`
          UPDATE "Product" 
          SET stock = CASE id 
            ${Prisma.raw(updateCases)}
            ELSE stock 
          END
          WHERE id IN (${Prisma.join(productIds)})
        `;
      }
      
      if (document.clientId) {
        await tx.client.update({
          where: { id: document.clientId },
          data: {
            totalOrders: { decrement: 1 },
            totalSpent: { decrement: document.total }
          }
        });
      }
      
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
 * Получить документы по клиенту (ОПТИМИЗИРОВАННО)
 * ✅ ИСПРАВЛЕНО: добавлен client с city
 */
export const getDocumentsByClient = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { clientId } = req.params;
    const clientIdNum = parseInt(clientId);
    
    if (isNaN(clientIdNum)) {
      res.status(400).json({ message: 'Неверный ID клиента' });
      return;
    }
    
    const documents = await prisma.saleDocument.findMany({
      where: { clientId: clientIdNum },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        subtotal: true,
        discount: true,
        total: true,
        paymentStatus: true,
        orderStatus: true,
        saleDate: true,
        createdBy: true,
        sellerName: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            price: true,
            total: true
          }
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            city: true,
            discountPercent: true
          }
        }
      },
      orderBy: { saleDate: 'desc' },
      take: 50
    });
    
    res.json(documents);
  } catch (error) {
    console.error('Error getting documents by client:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов клиента' });
  }
};

/**
 * PATCH /api/sale-documents/:id/status
 * Обновить статус заказа
 */
export const updateOrderStatus = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id);
    const { orderStatus } = req.body;
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
    const document = await prisma.saleDocument.update({
      where: { id: documentId },
      data: { orderStatus },
      select: {
        id: true,
        documentNumber: true,
        orderStatus: true,
        sellerName: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true
          }
        }
      }
    });
    
    res.json(document);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Ошибка обновления статуса заказа' });
  }
};

/**
 * GET /api/sale-documents/:id/status
 * Получить статус заказа
 */
export const getOrderStatus = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id);
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
    const document = await prisma.saleDocument.findUnique({
      where: { id: documentId },
      select: { 
        id: true, 
        orderStatus: true,
        documentNumber: true,
        sellerName: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true
          }
        }
      }
    });
    
    if (!document) {
      res.status(404).json({ message: 'Документ не найден' });
      return;
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error getting order status:', error);
    res.status(500).json({ message: 'Ошибка получения статуса заказа' });
  }
};

/**
 * GET /api/sale-documents/stats/clients
 * Статистика по клиентам (ОПТИМИЗИРОВАННО)
 */
export const getClientStatistics = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.first_name as firstName,
        c.last_name as lastName,
        c.phone,
        c.city,
        COUNT(sd.id) as orderCount,
        COALESCE(SUM(sd.total), 0) as totalSpent,
        MAX(sd.sale_date) as lastOrderDate
      FROM "Client" c
      LEFT JOIN "SaleDocument" sd ON c.id = sd.client_id AND sd.payment_status = 'paid'
      GROUP BY c.id, c.first_name, c.last_name, c.phone, c.city
      ORDER BY totalSpent DESC NULLS LAST
      LIMIT 10
    `;
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting client statistics:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики' });
  }
};

// Очистка кэша каждые 10 секунд
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of productCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      productCache.delete(key);
    }
  }
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp > USER_CACHE_TTL) {
      userCache.delete(key);
    }
  }
}, 10000);
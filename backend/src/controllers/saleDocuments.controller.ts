// crm-project/backend/src/controllers/saleDocuments.controller.ts
import { Response, Request } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser, CreateSaleDocumentDTO } from '../types';
import {
  OrderLifecycleError,
  updateAuthoritativeOrderStatus,
} from '../services/orderLifecycle.service';
import {
  canTransitionPaymentStatus,
  isPaymentStatus,
} from '../domain/orderStateMachine';
import {
  buildExternalPayloadHash,
  isValidExternalOrderId,
} from '../domain/publicOrderIdempotency';

const prisma = new PrismaClient();

// Кэш для товаров
const productCache = new Map<number, { 
  stock: number; 
  cost_price: number; 
  name: string; 
  article: string; 
  timestamp: number 
}>();
const CACHE_TTL = 5000;

// Кэш для пользователей
const userCache = new Map<number, { name: string; email: string; timestamp: number }>();
const USER_CACHE_TTL = 60000;

// Нормализация телефона
const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

const findOrCreateWebsiteClient = async (
  tx: Prisma.TransactionClient,
  clientData: any
): Promise<any> => {
  const normalizedPhone = normalizePhone(clientData.phone);
  const clients = await tx.client.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      phone: true,
      email: true,
      preferredContact: true,
      city: true,
      address: true,
    },
  });
  const existing = clients.find(item => normalizePhone(item.phone) === normalizedPhone);
  if (existing) {
    return tx.client.update({
      where: { id: existing.id },
      data: {
        firstName: clientData.firstName || existing.firstName,
        lastName: clientData.lastName ?? existing.lastName,
        middleName: clientData.middleName ?? existing.middleName,
        email: clientData.email || existing.email,
        address: clientData.address || existing.address,
        city: clientData.city || existing.city,
        preferredContact: clientData.preferredContact || existing.preferredContact,
      },
    });
  }

  return tx.client.upsert({
    where: { phone: clientData.phone },
    update: {},
    create: {
      firstName: clientData.firstName || 'Клиент',
      lastName: clientData.lastName || '',
      middleName: clientData.middleName || '',
      phone: clientData.phone,
      email: clientData.email || null,
      preferredContact: clientData.preferredContact || null,
      city: clientData.city || null,
      address: clientData.address || null,
      discountPercent: 0,
    },
  });
};

const sendPublicOrderResponse = (
  res: Response,
  document: any,
  statusCode: 200 | 201,
  idempotent: boolean
): void => {
  res.status(statusCode).json({
    success: true,
    orderId: document.id,
    externalOrderId: document.externalOrderId,
    documentNumber: document.documentNumber,
    total: document.total,
    clientId: document.clientId,
    paymentStatus: document.paymentStatus,
    orderStatus: document.orderStatus,
    statusVersion: document.statusVersion,
    idempotent,
    message: idempotent
      ? 'Order already exists'
      : 'Order successfully created',
  });
};

/**
 * GET /api/sale-documents
 */
export const getSaleDocuments = async (req: RequestWithUser, res: Response): Promise<void> => {
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
        customerEmail: true,
        customerAddress: true,
        contactMethod: true,
        deliveryMethod: true,
        deliveryProvider: true,
        subtotal: true,
        discount: true,
        total: true,
        paymentStatus: true,
        orderStatus: true,
        saleDate: true,
        createdAt: true,
        createdBy: true,
        sellerName: true,
        source: true,
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
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            email: true,
            city: true,
            carModel: true,
            carNumber: true,
            discountPercent: true,
            totalOrders: true,
            totalSpent: true
          }
        }
      },
      orderBy: { saleDate: 'desc' },
     
    });
    res.json(documents);
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов' });
  }
};

/**
 * GET /api/sale-documents/:id
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
        contactMethod: true,
        deliveryMethod: true,
        deliveryProvider: true,
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
        source: true,
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
 * POST /api/sale-documents/public
 * ПУБЛИЧНЫЙ эндпоинт для создания заказа с сайта (без JWT)
 */
export const createPublicOrder = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let requestExternalOrderId: string | null = null;
  let requestPayloadHash: string | null = null;
  try {
    const data = req.body;
    // A reservation already owns both stock and its immutable quote. Never let
    // an old/misrouted worker send that payload through the legacy path, which
    // would perform a second stock decrement and a fresh price lookup.
    if (data?.reservationId != null || data?.contractVersion != null) {
      res.status(409).json({
        success: false,
        code: 'RESERVED_ORDER_REQUIRES_V1_CONSUME',
        message: 'Reserved orders must use the versioned reservation consume endpoint',
      });
      return;
    }
    const {
      externalOrderId: externalOrderIdRaw,
      items,
      client,
      deliveryMethod,
      deliveryAddress,
      deliveryProvider,
      contactMethod,
      comment
    } = data;

    if (
      typeof externalOrderIdRaw !== 'string'
      || !isValidExternalOrderId(externalOrderIdRaw)
    ) {
      res.status(400).json({
        success: false,
        message: 'externalOrderId is required and must be a valid identifier',
      });
      return;
    }
    requestExternalOrderId = externalOrderIdRaw.trim();

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Корзина не может быть пустой' });
      return;
    }
    const invalidItem = items.find((item: any) =>
      !Number.isInteger(item?.productId) || item.productId <= 0 ||
      !Number.isInteger(item?.quantity) || item.quantity <= 0
    );
    if (invalidItem) {
      res.status(400).json({ success: false, message: 'productId и quantity должны быть положительными целыми числами' });
      return;
    }

    const uniqueProductIds = new Set(items.map((item: any) => item.productId));
    if (uniqueProductIds.size !== items.length) {
      res.status(400).json({ success: false, message: 'Один товар не может повторяться в нескольких строках заказа' });
      return;
    }
    if (!client?.phone) {
      res.status(400).json({ success: false, message: 'Телефон клиента обязателен' });
      return;
    }

    requestPayloadHash = buildExternalPayloadHash(data);
    const existingOrder = await (prisma.saleDocument as any).findUnique({
      where: { externalOrderId: requestExternalOrderId },
    });
    if (existingOrder) {
      if (existingOrder.externalPayloadHash !== requestPayloadHash) {
        res.status(409).json({
          success: false,
          message: 'externalOrderId is already used for a different order payload',
        });
        return;
      }

      sendPublicOrderResponse(res, existingOrder, 200, true);
      return;
    }

    const productIds = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, article: true, cost_price: true, stock: true, retail_price: true }
    });
    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map(p => p.id));
      const missingIds = productIds.filter((id: number) => !foundIds.has(id));
      res.status(404).json({ success: false, message: `Товары не найдены: ${missingIds.join(', ')}` });
      return;
    }

    const productMap = new Map(products.map(p => [p.id, p]));
    let subtotal = 0;
    const itemsWithDetails = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      if (product.stock < item.quantity) {
        res.status(400).json({ success: false, message: `Недостаточно товара "${product.name}" на складе. Доступно: ${product.stock}` });
        return;
      }
      // Цена из запроса является только снимком корзины. Итог всегда считает CRM.
      const price = product.retail_price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;
      itemsWithDetails.push({
        productId: item.productId,
        quantity: item.quantity,
        price: price,
        product,
        total: itemTotal
      });
    }

    // === СОЗДАНИЕ ЗАКАЗА ===
    const result = await prisma.$transaction(async (tx) => {
      // Serializes all attempts for the same external order across CRM instances.
      // PostgreSQL returns `void` here, which Prisma cannot deserialize (P2010).
      // Casting keeps the transaction-scoped lock and makes the result transportable.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${requestExternalOrderId}, 0)
        )::text AS "lockResult"
      `;

      const orderAfterLock = await (tx.saleDocument as any).findUnique({
        where: { externalOrderId: requestExternalOrderId },
      });
      if (orderAfterLock) {
        if (orderAfterLock.externalPayloadHash !== requestPayloadHash) {
          const conflict = new Error('externalOrderId payload conflict');
          conflict.name = 'IdempotencyConflictError';
          throw conflict;
        }
        return { document: orderAfterLock, idempotent: true };
      }

      const dbClient = await findOrCreateWebsiteClient(tx, client);

      // Условное списание внутри транзакции не позволяет параллельным заказам
      // одновременно пройти проверку и увести остаток ниже нуля.
      for (const item of itemsWithDetails) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });

        if (updated.count !== 1) {
          const stockError = new Error(`Недостаточно товара "${item.product.name}" на складе`);
          stockError.name = 'InsufficientStockError';
          throw stockError;
        }
      }

      let documentNumber: string | null = null;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        attempts++;
        const prefix = 'ЗАКАЗ';
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const candidate = `${prefix}-${dateStr}-${timestamp}-${random}`;
        
        const existing = await tx.saleDocument.findUnique({
          where: { documentNumber: candidate }
        });
        
        if (!existing) {
          documentNumber = candidate;
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      if (!documentNumber) {
        const prefix = 'ЗАКАЗ';
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        documentNumber = `${prefix}-${dateStr}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      }

      const document = await (tx.saleDocument as any).create({
        data: {
          documentNumber,
          externalOrderId: requestExternalOrderId,
          externalPayloadHash: requestPayloadHash,
          documentType: 'order',
          clientId: dbClient.id,
          clientName: [dbClient.lastName, dbClient.firstName, dbClient.middleName].filter(Boolean).join(' ') || dbClient.firstName,
          clientPhone: dbClient.phone,
          customerName: [dbClient.lastName, dbClient.firstName, dbClient.middleName].filter(Boolean).join(' ') || dbClient.firstName,
          customerPhone: dbClient.phone,
          customerEmail: dbClient.email,
          customerAddress: deliveryAddress || null,
          contactMethod: contactMethod || client?.preferredContact || 'phone',
          deliveryMethod: deliveryMethod || 'pickup',
          deliveryProvider: deliveryProvider || null,
          description: comment || null,
          subtotal,
          discount: 0,
          total: subtotal,
          paymentMethod: 'online',
          paymentStatus: 'paid',
          saleDate: new Date(),
          createdBy: null,
          sellerName: 'Сайт SWAPSERVICE38',
          source: 'website',
          orderStatus: 'confirmed',
          statusVersion: 0,
        }
      });

      await tx.saleDocumentItem.deleteMany({
        where: { documentId: document.id }
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

      await tx.client.update({
        where: { id: dbClient.id },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: subtotal }
        }
      });

      await tx.sale.createMany({
        data: itemsWithDetails.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          selling_price: item.price,
          total_cost: item.product.cost_price * item.quantity,
          total_revenue: item.total,
          profit: item.total - (item.product.cost_price * item.quantity),
          customer_name: [dbClient.lastName, dbClient.firstName].filter(Boolean).join(' ') || dbClient.firstName,
          customer_phone: dbClient.phone,
          documentId: document.id,
          sale_date: new Date()
        }))
      });

      return { document, idempotent: false };
    }, {
      timeout: 15000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Заказ с сайта создан за ${duration}ms: ${result.document.documentNumber}`);

    sendPublicOrderResponse(
      res,
      result.document,
      result.idempotent ? 200 : 201,
      result.idempotent
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    if (error instanceof Error && error.name === 'InsufficientStockError') {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error && error.name === 'IdempotencyConflictError') {
      res.status(409).json({
        success: false,
        message: 'externalOrderId is already used for a different order payload',
      });
      return;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
      && requestExternalOrderId
      && requestPayloadHash
    ) {
      const existingOrder = await (prisma.saleDocument as any).findUnique({
        where: { externalOrderId: requestExternalOrderId },
      });
      if (existingOrder?.externalPayloadHash === requestPayloadHash) {
        sendPublicOrderResponse(res, existingOrder, 200, true);
        return;
      }
      if (existingOrder) {
        res.status(409).json({
          success: false,
          message: 'externalOrderId is already used for a different order payload',
        });
        return;
      }
    }
    console.error(`Public order creation failed after ${duration}ms`, {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    });
    res.status(500).json({
      success: false,
      message: 'Ошибка создания заказа'
    });
  }
};

/**
 * POST /api/sale-documents
 * Создать документ продажи (для менеджеров)
 */
export const createSaleDocument = async (req: RequestWithUser, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!req.user && !(req as RequestWithUser & { internalService?: boolean }).internalService) {
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

    if (!isPaymentStatus(paymentStatus)) {
      res.status(400).json({ message: 'Invalid paymentStatus' });
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
      let documentNumber: string | null = null;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        attempts++;
        const prefix = documentType === 'receipt' ? 'ЧЕК' : documentType === 'invoice' ? 'СЧЕТ' : 'ЗАКАЗ';
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const candidate = `${prefix}-${dateStr}-${timestamp}-${random}`;
        
        const existing = await tx.saleDocument.findUnique({
          where: { documentNumber: candidate }
        });
        
        if (!existing) {
          documentNumber = candidate;
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      if (!documentNumber) {
        const prefix = documentType === 'receipt' ? 'ЧЕК' : documentType === 'invoice' ? 'СЧЕТ' : 'ЗАКАЗ';
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        documentNumber = `${prefix}-${dateStr}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      }
      
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
          orderStatus: 'confirmed',
          source: 'instore'
        }
      });

      await tx.saleDocumentItem.deleteMany({
        where: { documentId: document.id }
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
        source: true,
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
    res.status(500).json({ message: error instanceof Error ? error.message : 'Ошибка создания документа' });
  }
};

/**
 * PUT /api/sale-documents/:id
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

    const existingDocument = await prisma.saleDocument.findUnique({
      where: { id: documentId },
      select: { paymentStatus: true },
    });
    if (!existingDocument) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }
    if (paymentStatus !== undefined) {
      if (!isPaymentStatus(paymentStatus)) {
        res.status(400).json({ message: 'Invalid paymentStatus' });
        return;
      }
      if (!canTransitionPaymentStatus(existingDocument.paymentStatus, paymentStatus)) {
        res.status(409).json({
          message: `Invalid payment status transition: ${existingDocument.paymentStatus} -> ${paymentStatus}`,
        });
        return;
      }
    }
    
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
        source: true,
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
 * PUT /api/sale-documents/:id/full
 */
export const updateFullOrder = async (req: RequestWithUser, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const isInternalService = (req as RequestWithUser & { internalService?: boolean }).internalService === true;
    if (!req.user && !isInternalService) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    
    const { id } = req.params;
    const documentId = parseInt(id);
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
    const {
      items,
      discount,
      description,
      clientData,
      deliveryMethod,
      deliveryAddress,
      deliveryProvider,
      contactMethod,
    } = req.body;
    
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
    
    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, article: true, cost_price: true, stock: true }
    });
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const missingIds = productIds.filter(id => !productMap.has(id));
    if (missingIds.length > 0) {
      res.status(404).json({ message: `Товары не найдены: ${missingIds.join(', ')}` });
      return;
    }
    
    let subtotal = 0;
    const itemsWithDetails = [];
    const oldQuantities = new Map<number, number>();
    for (const oldItem of existingDocument.items) {
      oldQuantities.set(oldItem.productId, oldItem.quantity);
    }
    
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      
      const oldQuantity = oldQuantities.get(item.productId) || 0;
      const quantityDelta = item.quantity - oldQuantity;
      
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
    
    const totalDiscount = discount || 0;
    const total = Math.max(0, subtotal - totalDiscount);
    
    let clientId = existingDocument.clientId;
    if (clientData && (clientData.name || clientData.phone)) {
      let client = null;
      if (clientData.phone) {
        client = await prisma.client.findFirst({
          where: { phone: clientData.phone }
        });
      }
      
      if (client) {
        clientId = client.id;
        await prisma.client.update({
          where: { id: client.id },
          data: {
            firstName: clientData.name.split(' ')[1] || clientData.name,
            lastName: clientData.name.split(' ')[0] || '',
            middleName: clientData.name.split(' ')[2] || '',
            phone: clientData.phone,
            email: clientData.email || undefined,
            city: clientData.city || undefined,
            address: clientData.address || undefined,
            preferredContact: clientData.preferredContact || contactMethod || undefined,
          }
        });
      } else if (clientData.name || clientData.phone) {
        const nameParts = clientData.name.split(' ');
        const newClient = await prisma.client.create({
          data: {
            firstName: nameParts[1] || clientData.name,
            lastName: nameParts[0] || '',
            middleName: nameParts[2] || '',
            phone: clientData.phone,
            email: clientData.email || null,
            city: clientData.city || null,
            address: clientData.address || null,
            preferredContact: clientData.preferredContact || contactMethod || null,
          }
        });
        clientId = newClient.id;
      }
    }
    
    const oldTotal = existingDocument.total;
    const totalDelta = total - oldTotal;
    
    await prisma.$transaction(async (tx) => {
      for (const oldItem of existingDocument.items) {
        await tx.$executeRaw`
          UPDATE "Product" 
          SET stock = stock + ${oldItem.quantity}
          WHERE id = ${oldItem.productId}
        `;
      }
      
      await tx.saleDocument.update({
        where: { id: documentId },
        data: {
          clientId: clientId,
          clientName: clientData?.name || existingDocument.clientName,
          clientPhone: clientData?.phone || existingDocument.clientPhone,
          customerName: clientData?.name || existingDocument.customerName,
          customerPhone: clientData?.phone || existingDocument.customerPhone,
          customerEmail: clientData?.email || existingDocument.customerEmail,
          customerAddress: clientData?.address || existingDocument.customerAddress,
          contactMethod: contactMethod !== undefined ? contactMethod : existingDocument.contactMethod,
          deliveryMethod: deliveryMethod !== undefined ? deliveryMethod : existingDocument.deliveryMethod,
          deliveryProvider: deliveryProvider !== undefined ? deliveryProvider : existingDocument.deliveryProvider,
          subtotal: subtotal,
          discount: totalDiscount,
          total: total,
          description: description !== undefined ? description : existingDocument.description,
        }
      });
      
      await tx.saleDocumentItem.deleteMany({
        where: { documentId: documentId }
      });
      
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
    }, {
      timeout: 15000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });
    
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`⚠️ Slow order update: ${duration}ms`);
    }
    
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
        contactMethod: true,
        deliveryMethod: true,
        deliveryProvider: true,
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
        source: true,
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
    res.status(500).json({ message: error instanceof Error ? error.message : 'Ошибка обновления заказа' });
  }
};

/**
 * PATCH /api/sale-documents/:id/payment-status
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

    if (!isPaymentStatus(paymentStatus)) {
      res.status(400).json({ message: 'Invalid paymentStatus' });
      return;
    }

    const currentDocument = await prisma.saleDocument.findUnique({
      where: { id: documentId },
      select: { paymentStatus: true },
    });
    if (!currentDocument) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }
    if (!canTransitionPaymentStatus(currentDocument.paymentStatus, paymentStatus)) {
      res.status(409).json({
        message: `Invalid payment status transition: ${currentDocument.paymentStatus} -> ${paymentStatus}`,
      });
      return;
    }

    const updated = await prisma.saleDocument.updateMany({
      where: { id: documentId, paymentStatus: currentDocument.paymentStatus },
      data: { paymentStatus },
    });
    if (updated.count !== 1) {
      res.status(409).json({ message: 'Payment status changed concurrently; reload and retry' });
      return;
    }

    const document = await prisma.saleDocument.findUniqueOrThrow({
      where: { id: documentId },
      select: {
        id: true,
        documentNumber: true,
        paymentStatus: true,
        sellerName: true,
        source: true,
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
 * PATCH /api/sale-documents/:id/status
 * ОБНОВЛЕНИЕ СТАТУСА ЗАКАЗА С ОТПРАВКОЙ ВЕБХУКА
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

    const lifecycle = await updateAuthoritativeOrderStatus(prisma, documentId, orderStatus);
    const document = await (prisma.saleDocument as any).findUniqueOrThrow({
      where: { id: documentId },
      select: {
        id: true,
        documentNumber: true,
        orderStatus: true,
        statusVersion: true,
        sellerName: true,
        source: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
          },
        },
      },
    });
    res.json({
      ...document,
      statusSaved: true,
      siteSynchronizationQueued: lifecycle.source === 'website',
    });
  } catch (error) {
    if (error instanceof OrderLifecycleError) {
      res.status(error.statusCode).json({ code: error.code, message: error.message });
      return;
    }
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Ошибка обновления статуса заказа' });
  }
};

/**
 * GET /api/sale-documents/:id/status
 */
export const getOrderStatus = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id);
    
    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Неверный ID документа' });
      return;
    }
    
    const document = await (prisma.saleDocument as any).findUnique({
      where: { id: documentId },
      select: { 
        id: true, 
        orderStatus: true,
        statusVersion: true,
        documentNumber: true,
        sellerName: true,
        source: true,
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
 * DELETE /api/sale-documents/:id
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
    res.status(500).json({ message: error instanceof Error ? error.message : 'Ошибка удаления документа' });
  }
};

/**
 * GET /api/sale-documents/client/:clientId
 * Получить все заказы клиента (для страницы "Мои заказы")
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
        createdAt: true,
        createdBy: true,
        sellerName: true,
        source: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerAddress: true,
        description: true,
        items: {
          select: {
            id: true,
            productName: true,
            productArticle: true,
            quantity: true,
            price: true,
            total: true,
            cost_price: true,
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
            discountPercent: true,
            totalOrders: true,
            totalSpent: true,
          }
        }
      },
      orderBy: { saleDate: 'desc' },
      take: 9999
    });
    
    res.json(documents);
  } catch (error) {
    console.error('Error getting documents by client:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов клиента' });
  }
};

/**
 * GET /api/sale-documents/stats/clients
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

// Очистка кэша
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

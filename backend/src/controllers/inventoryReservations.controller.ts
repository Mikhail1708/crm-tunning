import crypto from 'crypto';
import { Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  buildReservationPayloadHash,
  DEFAULT_RESERVATION_TTL_MS,
  minorUnitsForJson,
  normalizeReservationItems,
  parseMinorUnits,
  RESERVATION_CURRENCY,
  toMinorUnits,
} from '../domain/inventoryReservation';
import { isValidExternalOrderId } from '../domain/publicOrderIdempotency';

const prisma = new PrismaClient();

type LockedProduct = {
  id: number;
  name: string;
  article: string | null;
  cost_price: number;
  retail_price: number;
  stock: number;
};

class ReservationHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ReservationHttpError';
  }
}

const reservationTtlMs = (): number => {
  const configured = Number(process.env.INVENTORY_RESERVATION_TTL_MS);
  return Number.isSafeInteger(configured) && configured >= 60_000
    ? configured
    : DEFAULT_RESERVATION_TTL_MS;
};

const lockReservation = async (tx: Prisma.TransactionClient, externalOrderId: string): Promise<void> => {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${externalOrderId}, 1))::text AS "lockResult"
  `;
};

const reservationJson = (reservation: any) => ({
  reservationId: reservation.id,
  externalOrderId: reservation.externalOrderId,
  status: reservation.status,
  currency: reservation.currency,
  totalMinor: minorUnitsForJson(reservation.totalMinor),
  expiresAt: reservation.expiresAt,
  items: (reservation.items || []).map((item: any) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPriceMinor: minorUnitsForJson(item.unitPriceMinor),
    totalMinor: minorUnitsForJson(item.totalMinor),
  })),
});

const restoreReservedStock = async (
  tx: Prisma.TransactionClient,
  items: Array<{ productId: number; quantity: number }>,
): Promise<void> => {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
};

const releaseReservationTransaction = async (
  reservationId: string,
  terminalStatus: 'released' | 'expired',
) => prisma.$transaction(async tx => {
  const initial = await tx.inventoryReservation.findUnique({ where: { id: reservationId } });
  if (!initial) throw new ReservationHttpError(404, 'Reservation not found');
  await lockReservation(tx, initial.externalOrderId);

  const reservation = await tx.inventoryReservation.findUnique({
    where: { id: reservationId },
    include: { items: true },
  });
  if (!reservation) throw new ReservationHttpError(404, 'Reservation not found');
  if (reservation.status === 'consumed') {
    throw new ReservationHttpError(409, 'Consumed reservation cannot be released');
  }
  if (reservation.status !== 'active') return reservation;

  await restoreReservedStock(tx, reservation.items);
  return tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: { status: terminalStatus },
    include: { items: true },
  });
}, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 });

export const createInventoryReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const externalOrderId = typeof req.body?.externalOrderId === 'string'
      ? req.body.externalOrderId.trim()
      : '';
    const currency = req.body?.currency;
    const items = normalizeReservationItems(req.body?.items);
    if (!isValidExternalOrderId(externalOrderId) || currency !== RESERVATION_CURRENCY || !items) {
      res.status(400).json({ success: false, message: 'Invalid reservation payload' });
      return;
    }

    const payloadHash = buildReservationPayloadHash(externalOrderId, currency, items);
    const result = await prisma.$transaction(async tx => {
      await lockReservation(tx, externalOrderId);
      const existing = await tx.inventoryReservation.findUnique({
        where: { externalOrderId },
        include: { items: true },
      });
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new ReservationHttpError(409, 'externalOrderId is already used for a different reservation payload');
        }
        if (existing.status === 'active' && existing.expiresAt <= new Date()) {
          await restoreReservedStock(tx, existing.items);
          const expired = await tx.inventoryReservation.update({
            where: { id: existing.id },
            data: { status: 'expired' },
            include: { items: true },
          });
          return { reservation: expired, idempotent: true };
        }
        return { reservation: existing, idempotent: true };
      }

      const productIds = items.map(item => item.productId);
      const products = await tx.$queryRaw<LockedProduct[]>`
        SELECT id, name, article, cost_price, retail_price, stock
        FROM "Product"
        WHERE id IN (${Prisma.join(productIds)})
        ORDER BY id
        FOR UPDATE
      `;
      if (products.length !== productIds.length) {
        throw new ReservationHttpError(404, 'One or more products were not found');
      }

      const productById = new Map(products.map(product => [product.id, product]));
      const lockedItems = items.map(item => {
        const product = productById.get(item.productId)!;
        if (product.stock < item.quantity) {
          throw new ReservationHttpError(409, `Insufficient stock for product ${item.productId}`);
        }
        const unitPriceMinor = toMinorUnits(product.retail_price);
        return {
          ...item,
          unitPriceMinor,
          totalMinor: unitPriceMinor * BigInt(item.quantity),
          productName: product.name,
          productArticle: product.article || '—',
          costPrice: product.cost_price,
        };
      });

      for (const item of lockedItems) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new ReservationHttpError(409, `Insufficient stock for product ${item.productId}`);
        }
      }

      const totalMinor = lockedItems.reduce((sum, item) => sum + item.totalMinor, 0n);
      const reservation = await tx.inventoryReservation.create({
        data: {
          externalOrderId,
          payloadHash,
          currency,
          totalMinor,
          expiresAt: new Date(Date.now() + reservationTtlMs()),
          items: {
            create: lockedItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPriceMinor: item.unitPriceMinor,
              totalMinor: item.totalMinor,
              productName: item.productName,
              productArticle: item.productArticle,
              costPrice: item.costPrice,
            })),
          },
        },
        include: { items: true },
      });
      return { reservation, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 });

    if (result.reservation.status !== 'active') {
      res.status(409).json({
        success: false,
        code: `RESERVATION_${String(result.reservation.status).toUpperCase()}`,
        ...reservationJson(result.reservation),
      });
      return;
    }
    res.status(result.idempotent ? 200 : 201).json({
      success: true,
      idempotent: result.idempotent,
      ...reservationJson(result.reservation),
    });
  } catch (error) {
    const status = error instanceof ReservationHttpError ? error.status : 500;
    res.status(status).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to reserve inventory',
    });
  }
};

export const releaseInventoryReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const reservation = await releaseReservationTransaction(req.params.reservationId, 'released');
    res.json({ success: true, ...reservationJson(reservation) });
  } catch (error) {
    const status = error instanceof ReservationHttpError ? error.status : 500;
    res.status(status).json({ success: false, message: error instanceof Error ? error.message : 'Failed to release reservation' });
  }
};

export const expireInventoryReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedLimit = Number(req.body?.limit ?? 100);
    const limit = Number.isSafeInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
    const result = await expireStaleInventoryReservations(limit);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to expire reservations' });
  }
};

export const expireStaleInventoryReservations = async (limit = 100): Promise<{ scanned: number; expired: number }> => {
  const candidates = await prisma.inventoryReservation.findMany({
    where: { status: 'active', expiresAt: { lte: new Date() } },
    select: { id: true },
    orderBy: { expiresAt: 'asc' },
    take: Math.min(Math.max(limit, 1), 500),
  });
  let expired = 0;
  for (const candidate of candidates) {
    try {
      const reservation = await releaseReservationTransaction(candidate.id, 'expired');
      if (reservation.status === 'expired') expired += 1;
    } catch (error) {
      // A concurrent consume/release can legitimately win after the candidate scan.
      if (!(error instanceof ReservationHttpError) || ![404, 409].includes(error.status)) throw error;
    }
  }
  return { scanned: candidates.length, expired };
};

let expiryWorker: NodeJS.Timeout | null = null;

export const startInventoryReservationExpiryWorker = (): void => {
  if (expiryWorker) return;
  const configured = Number(process.env.INVENTORY_RESERVATION_SWEEP_MS);
  const intervalMs = Number.isSafeInteger(configured) && configured >= 10_000 ? configured : 60_000;
  expiryWorker = setInterval(() => {
    expireStaleInventoryReservations().catch(error => {
      console.error('Inventory reservation expiry sweep failed:', error);
    });
  }, intervalMs);
  expiryWorker.unref();
};

const normalizePhone = (phone: string): string => String(phone || '').replace(/\D/g, '');

const findOrCreateClient = async (tx: Prisma.TransactionClient, clientData: any): Promise<any> => {
  const normalizedPhone = normalizePhone(clientData?.phone);
  if (!normalizedPhone) throw new ReservationHttpError(400, 'Client phone is required');
  const clients = await tx.client.findMany({
    select: { id: true, firstName: true, lastName: true, middleName: true, phone: true, email: true, address: true, preferredContact: true },
  });
  const existing = clients.find(client => normalizePhone(client.phone) === normalizedPhone);
  if (existing) {
    return tx.client.update({
      where: { id: existing.id },
      data: {
        firstName: clientData.firstName || existing.firstName,
        lastName: clientData.lastName ?? existing.lastName,
        middleName: clientData.middleName ?? existing.middleName,
        email: clientData.email || existing.email,
        address: clientData.address || existing.address,
        preferredContact: clientData.preferredContact || existing.preferredContact,
      },
    });
  }
  return tx.client.create({
    data: {
      firstName: clientData.firstName || 'Клиент',
      lastName: clientData.lastName || '',
      middleName: clientData.middleName || '',
      phone: clientData.phone,
      email: clientData.email || null,
      address: clientData.address || null,
      preferredContact: clientData.preferredContact || null,
      discountPercent: 0,
    },
  });
};

export const consumeInventoryReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const reservationId = req.params.reservationId;
    const externalOrderId = typeof req.body?.externalOrderId === 'string' ? req.body.externalOrderId.trim() : '';
    const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : '';
    const paidAmountMinor = parseMinorUnits(req.body?.paidAmountMinor);
    const currency = req.body?.currency;
    const requestItems = normalizeReservationItems(req.body?.items);
    if (
      !reservationId || !isValidExternalOrderId(externalOrderId)
      || !paymentId || paymentId.length > 255
      || paidAmountMinor === null || currency !== RESERVATION_CURRENCY || !requestItems
    ) {
      res.status(400).json({ success: false, message: 'Invalid reservation consumption payload' });
      return;
    }

    const result = await prisma.$transaction(async tx => {
      const initial = await tx.inventoryReservation.findUnique({ where: { id: reservationId } });
      if (!initial) throw new ReservationHttpError(404, 'Reservation not found');
      await lockReservation(tx, initial.externalOrderId);
      const reservation = await tx.inventoryReservation.findUnique({
        where: { id: reservationId },
        include: { items: true, saleDocument: true },
      });
      if (!reservation) throw new ReservationHttpError(404, 'Reservation not found');
      if (reservation.externalOrderId !== externalOrderId) {
        throw new ReservationHttpError(409, 'Reservation does not belong to this order');
      }

      if (reservation.status === 'consumed') {
        if (
          reservation.paymentId !== paymentId
          || reservation.paidAmountMinor !== paidAmountMinor
          || reservation.currency !== currency
          || !reservation.saleDocument
        ) throw new ReservationHttpError(409, 'Reservation was consumed with different payment facts');
        return { document: reservation.saleDocument, idempotent: true };
      }
      if (reservation.status === 'expired') return { expired: true } as const;
      if (reservation.status !== 'active') throw new ReservationHttpError(409, `Reservation is ${reservation.status}`);
      if (reservation.expiresAt <= new Date()) {
        await restoreReservedStock(tx, reservation.items);
        await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: 'expired' } });
        return { expired: true } as const;
      }
      if (reservation.totalMinor !== paidAmountMinor || reservation.currency !== currency) {
        throw new ReservationHttpError(409, 'Paid amount or currency does not match reserved quote');
      }
      const reservedQuantities = new Map(reservation.items.map(item => [item.productId, item.quantity]));
      if (
        requestItems.length !== reservation.items.length
        || requestItems.some(item => reservedQuantities.get(item.productId) !== item.quantity)
      ) throw new ReservationHttpError(409, 'Order items do not match reservation');

      const client = await findOrCreateClient(tx, req.body.client);
      const documentNumber = `ЗАКАЗ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
      const total = minorUnitsForJson(reservation.totalMinor) / 100;
      const document = await tx.saleDocument.create({
        data: {
          documentNumber,
          externalOrderId,
          externalPayloadHash: reservation.payloadHash,
          externalPaymentId: paymentId,
          paidAmountMinor,
          paymentCurrency: currency,
          documentType: 'order',
          clientId: client.id,
          clientName: [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || client.firstName,
          clientPhone: client.phone,
          customerName: [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || client.firstName,
          customerPhone: client.phone,
          customerEmail: client.email,
          customerAddress: req.body.deliveryAddress || null,
          contactMethod: req.body.contactMethod || req.body.client?.preferredContact || 'phone',
          deliveryMethod: req.body.deliveryMethod || 'pickup',
          deliveryProvider: req.body.deliveryProvider || null,
          description: req.body.comment || null,
          subtotal: total,
          discount: 0,
          total,
          paymentMethod: 'online',
          paymentStatus: 'paid',
          orderStatus: 'confirmed',
          statusVersion: 0,
          saleDate: new Date(),
          createdBy: null,
          sellerName: 'Сайт SWAPSERVICE38',
          source: 'website',
          items: {
            create: reservation.items.map(item => ({
              productId: item.productId,
              productName: item.productName,
              productArticle: item.productArticle,
              quantity: item.quantity,
              price: minorUnitsForJson(item.unitPriceMinor) / 100,
              cost_price: item.costPrice,
              total: minorUnitsForJson(item.totalMinor) / 100,
            })),
          },
          sales: {
            create: reservation.items.map(item => {
              const revenue = minorUnitsForJson(item.totalMinor) / 100;
              const cost = item.costPrice * item.quantity;
              return {
                productId: item.productId,
                quantity: item.quantity,
                selling_price: minorUnitsForJson(item.unitPriceMinor) / 100,
                total_cost: cost,
                total_revenue: revenue,
                profit: revenue - cost,
                customer_name: [client.lastName, client.firstName].filter(Boolean).join(' ') || client.firstName,
                customer_phone: client.phone,
                sale_date: new Date(),
              };
            }),
          },
        },
      });
      await tx.client.update({
        where: { id: client.id },
        data: { totalOrders: { increment: 1 }, totalSpent: { increment: total } },
      });
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: 'consumed',
          paymentId,
          paidAmountMinor,
          saleDocumentId: document.id,
        },
      });
      return { document, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 });

    if ('expired' in result) {
      res.status(409).json({ success: false, code: 'RESERVATION_EXPIRED', message: 'Reservation expired before payment consumption' });
      return;
    }
    res.status(result.idempotent ? 200 : 201).json({
      success: true,
      idempotent: result.idempotent,
      orderId: result.document.id,
      externalOrderId: result.document.externalOrderId,
      documentNumber: result.document.documentNumber,
      total: result.document.total,
      paidAmountMinor: minorUnitsForJson(result.document.paidAmountMinor!),
      currency: result.document.paymentCurrency,
      paymentStatus: result.document.paymentStatus,
      orderStatus: result.document.orderStatus,
      statusVersion: result.document.statusVersion,
    });
  } catch (error) {
    const isUniqueConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    const status = error instanceof ReservationHttpError ? error.status : isUniqueConflict ? 409 : 500;
    res.status(status).json({
      success: false,
      message: isUniqueConflict ? 'Payment or order is already bound to another document' : error instanceof Error ? error.message : 'Failed to consume reservation',
    });
  }
};

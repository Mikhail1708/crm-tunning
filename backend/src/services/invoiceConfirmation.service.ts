import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { lockSaleDocument, SaleStockError } from './saleStock.service';
import { enqueueOrderStatusProjection } from './statusOutbox.service';

export async function confirmBankInvoicePayment(db: PrismaClient, documentId: number,
  actor: { id: number; role: string; name: string }) {
  if (!actor || !['admin', 'manager'].includes(actor.role) || !Number.isSafeInteger(actor.id)) {
    throw new SaleStockError(403, 'INVOICE_CONFIRMATION_FORBIDDEN', 'Manager permission required');
  }
  if (!Number.isSafeInteger(documentId) || documentId <= 0) throw new SaleStockError(400, 'INVALID_ORDER_ID', 'Invalid order');
  return db.$transaction(async tx => {
    const lockKey = `sale-document:${documentId}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 2))::text`;
    await lockSaleDocument(tx, documentId);
    const document = await tx.saleDocument.findUnique({ where: { id: documentId }, include: { items: true, invoiceAllocation: true } });
    if (!document) throw new SaleStockError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const allocation = document.invoiceAllocation;
    if (document.paymentMethod !== 'bank_invoice' || !allocation) throw new SaleStockError(409, 'NOT_BANK_INVOICE', 'Bank invoice required');
    if (document.paymentStatus === 'paid' && allocation.status === 'committed' && allocation.confirmationId) {
      return { confirmationId: allocation.confirmationId, paymentStatus: 'paid', idempotent: true };
    }
    if (document.paymentStatus !== 'unpaid' || allocation.status !== 'held' || document.orderStatus === 'cancelled'
      || !allocation.amountMinor || allocation.confirmationId) {
      throw new SaleStockError(409, 'INVOICE_CONFIRMATION_CONFLICT', 'Invoice cannot be confirmed');
    }
    const now = new Date();
    const confirmationId = randomUUID();
    const client = await tx.client.upsert({ where: { phone: document.customerPhone! },
      create: { phone: document.customerPhone!, firstName: document.customerName || document.clientName || 'Покупатель', email: document.customerEmail }, update: {} });
    await tx.client.update({ where: { id: client.id }, data: { totalOrders: { increment: 1 }, totalSpent: { increment: Number(allocation.amountMinor) / 100 } } });
    await tx.sale.createMany({ data: document.items.map(item => ({ productId: item.productId, quantity: item.quantity,
      selling_price: item.price, total_cost: item.cost_price * item.quantity, total_revenue: item.total,
      profit: item.total - item.cost_price * item.quantity, customer_name: document.customerName,
      customer_phone: document.customerPhone, documentId, sale_date: now })) });
    await tx.invoiceAllocation.update({ where: { id: allocation.id }, data: {
      status: 'committed', confirmationId, confirmedAt: now, confirmedById: actor.id, confirmedByName: actor.name,
    } });
    const updated = await tx.saleDocument.update({ where: { id: documentId }, data: {
      // Bank confirmation is not a YooKassa payment: externalPaymentId,
      // paidAmountMinor and paymentCurrency must remain NULL under the
      // existing external-payment facts constraint.
      paymentStatus: 'paid',
      clientId: client.id, statusVersion: { increment: 1 },
    } });
    await enqueueOrderStatusProjection(tx, updated);
    return { confirmationId, paymentStatus: 'paid', idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
}

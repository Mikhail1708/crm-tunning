import { createHash, randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { deductSaleStock, lockSaleDocument, lockStockProducts, SaleStockError } from './saleStock.service';
import { enqueueOrderStatusProjection } from './statusOutbox.service';
import { canTransitionOrderStatus } from '../domain/orderStateMachine';

const fail = (code: string, message = code): never => { throw new SaleStockError(409, code, message); };
const invalid = (): never => { throw new SaleStockError(400, 'INVALID_INVOICE_PAYLOAD', 'Invalid invoice payload'); };
const text = (v: unknown, max = 255): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && v.trim() === v;
const keys = (v: any, allowed: string[]) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => allowed.includes(k));
const minor = (v: unknown): v is string => typeof v === 'string' && /^[1-9]\d{0,14}$/.test(v) && BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER);

export function parseBankInvoiceIntake(value: any) {
  const p = value;
  if (!keys(p, ['contractVersion','requestId','externalOrderId','invoiceId','invoiceNumber','issuedAt','dueAt','amountMinor','currency','paymentMethod','paymentStatus','buyerSnapshot','itemsSnapshot','delivery'])
    || p.contractVersion !== 1 || !text(p.externalOrderId) || !text(p.invoiceId) || !text(p.invoiceNumber)
    || p.requestId !== `bank-invoice-intake:${p.invoiceId}` || p.currency !== 'RUB'
    || p.paymentMethod !== 'bank_invoice' || p.paymentStatus !== 'unpaid' || !minor(p.amountMinor)
    || !text(p.issuedAt) || !text(p.dueAt) || !Number.isFinite(Date.parse(p.issuedAt))
    || !Number.isFinite(Date.parse(p.dueAt)) || Date.parse(p.dueAt) <= Date.parse(p.issuedAt)) invalid();
  const b = p.buyerSnapshot;
  if (!keys(b, ['buyerType','legalName','inn','kpp','legalAddress','contactName','phone','email'])
    || !['legal_entity','individual_entrepreneur'].includes(b.buyerType)
    || !text(b.legalName, 500) || !text(b.legalAddress, 1000) || !text(b.contactName)
    || !text(b.phone, 50) || !text(b.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)
    || typeof b.inn !== 'string' || !(b.buyerType === 'legal_entity' ? /^\d{10}$/ : /^\d{12}$/).test(b.inn)
    || (b.buyerType === 'individual_entrepreneur' && b.kpp != null && b.kpp !== '')
    || (b.kpp != null && b.kpp !== '' && (typeof b.kpp !== 'string' || !/^\d{9}$/.test(b.kpp)))) invalid();
  if (!Array.isArray(p.itemsSnapshot) || !p.itemsSnapshot.length || p.itemsSnapshot.length > 500) invalid();
  const ids = new Set<string>();
  let sum = 0n;
  for (const i of p.itemsSnapshot) {
    if (!keys(i, ['productId','name','sku','quantity','unitPriceMinor','totalMinor'])
      || !text(i.productId) || !/^[1-9]\d*$/.test(i.productId) || Number(i.productId) > 2147483647
      || ids.has(i.productId) || !text(i.name, 1000) || (i.sku !== null && !text(i.sku))
      || !Number.isInteger(i.quantity) || i.quantity <= 0 || i.quantity > 2147483647
      || !minor(i.unitPriceMinor) || !minor(i.totalMinor)
      || BigInt(i.unitPriceMinor) * BigInt(i.quantity) !== BigInt(i.totalMinor)) invalid();
    ids.add(i.productId); sum += BigInt(i.totalMinor);
  }
  if (sum !== BigInt(p.amountMinor)) invalid();
  const d = p.delivery;
  if (!keys(d, ['method','address','provider','contactMethod','comment']) || !text(d.method) || !text(d.contactMethod)
    || !['address','provider','comment'].every(k => d[k] === null || text(d[k], 4000))) invalid();
  return p;
}

const canonical = (v: any): string => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);

async function lockIdentity(tx: Prisma.TransactionClient, externalOrderId: string) {
  // Same namespaces as legacy public order creation and online reservations.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${externalOrderId}, 0))::text`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${externalOrderId}, 1))::text`;
}
const response = (a: any) => ({ contractVersion: 1, externalOrderId: a.externalOrderId, invoiceId: a.invoiceId,
  invoiceNumber: a.invoiceNumber, crmOrderId: a.saleDocumentId, documentNumber: a.saleDocument?.documentNumber ?? null,
  amountMinor: a.amountMinor?.toString() ?? null, currency: a.currency, paymentMethod: 'bank_invoice',
  paymentStatus: a.saleDocument?.paymentStatus ?? 'unpaid', allocationStatus: a.status,
  dueAt: a.dueAt?.toISOString() ?? null, orderStatus: a.saleDocument?.orderStatus ?? 'cancelled', statusVersion: a.saleDocument?.statusVersion ?? 0 });

export async function intakeBankInvoice(prisma: PrismaClient, input: unknown) {
  const p = parseBankInvoiceIntake(input);
  const payloadHash = createHash('sha256').update(canonical(p)).digest('hex');
  return prisma.$transaction(async tx => {
    await lockIdentity(tx, p.externalOrderId);
    const existing = await tx.invoiceAllocation.findFirst({ where: { OR: [
      { externalOrderId: p.externalOrderId }, { invoiceId: p.invoiceId }, { requestId: p.requestId }, { invoiceNumber: p.invoiceNumber },
    ] }, include: { saleDocument: true } });
    if (existing) {
      if (existing.externalOrderId !== p.externalOrderId || existing.invoiceId !== p.invoiceId
        || (existing.payloadHash !== null && existing.payloadHash !== payloadHash)) fail('INVOICE_IDENTITY_CONFLICT');
      return response(existing);
    }
    if (await tx.saleDocument.findUnique({ where: { externalOrderId: p.externalOrderId } })) fail('ORDER_ALREADY_EXISTS');
    const reservation = await tx.inventoryReservation.findUnique({ where: { externalOrderId: p.externalOrderId } });
    if (reservation && !['released','expired'].includes(reservation.status)) fail('ONLINE_RESERVATION_ACTIVE');
    const stockItems = p.itemsSnapshot.map((i: any) => ({ productId: Number(i.productId), quantity: i.quantity }));
    await deductSaleStock(tx, stockItems);
    const products = await tx.product.findMany({ where: { id: { in: stockItems.map((i: any) => i.productId) } } });
    const cost = new Map(products.map(i => [i.id, i.cost_price]));
    const document = await tx.saleDocument.create({ data: {
      documentNumber: `WEB-${new Date(p.issuedAt).toISOString().slice(0,10).replace(/-/g,'')}-${randomUUID().slice(0,8).toUpperCase()}`,
      externalOrderId: p.externalOrderId, externalPayloadHash: payloadHash, documentType: 'order', source: 'website',
      customerName: p.buyerSnapshot.contactName, customerPhone: p.buyerSnapshot.phone, customerEmail: p.buyerSnapshot.email,
      clientName: p.buyerSnapshot.legalName, clientPhone: p.buyerSnapshot.phone, customerAddress: p.delivery.address,
      deliveryMethod: p.delivery.method, deliveryProvider: p.delivery.provider, contactMethod: p.delivery.contactMethod,
      description: p.delivery.comment, subtotal: Number(p.amountMinor)/100, total: Number(p.amountMinor)/100,
      paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', orderStatus: 'confirmed',
      items: { create: p.itemsSnapshot.map((i: any) => ({ productId: Number(i.productId), quantity: i.quantity,
        productName: i.name, productArticle: i.sku || '—', price: Number(i.unitPriceMinor)/100,
        total: Number(i.totalMinor)/100, cost_price: cost.get(Number(i.productId))! })) },
    } });
    const allocation = await tx.invoiceAllocation.create({ data: {
      id: randomUUID(), externalOrderId: p.externalOrderId, invoiceId: p.invoiceId, invoiceNumber: p.invoiceNumber,
      requestId: p.requestId, payloadHash, payload: p, amountMinor: BigInt(p.amountMinor), currency: 'RUB',
      dueAt: new Date(p.dueAt), status: 'held', saleDocumentId: document.id,
    }, include: { saleDocument: true } });
    return response(allocation);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
}

// Caller holds the document row lock. Never take identity locks here: lifecycle already owns the row.
export async function releaseInvoiceAllocationInTransaction(tx: Prisma.TransactionClient, document: { id: number; paymentStatus: string }) {
  const a = await tx.invoiceAllocation.findUnique({ where: { saleDocumentId: document.id } });
  if (!a) fail('INVOICE_ALLOCATION_MISSING');
  if (a.status === 'committed' || document.paymentStatus !== 'unpaid') fail('INVOICE_RELEASE_FORBIDDEN');
  if (a.status === 'released') return a;
  const items = (a.payload as any).itemsSnapshot.map((i: any) => ({ productId: Number(i.productId), quantity: i.quantity }));
  await lockStockProducts(tx, items.map(i => i.productId));
  for (const i of [...items].sort((a,b) => a.productId-b.productId)) {
    await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
  }
  return tx.invoiceAllocation.update({ where: { id: a.id }, data: { status: 'released', releasedAt: new Date() } });
}

export async function releaseBankInvoice(prisma: PrismaClient, externalOrderId: string, input: any) {
  if (!text(externalOrderId) || !keys(input, ['invoiceId','requestId','reason']) || !text(input.invoiceId)
    || input.requestId !== `bank-invoice-release:${input.invoiceId}` || !text(input.reason,1000)) invalid();
  return prisma.$transaction(async tx => {
    await lockIdentity(tx, externalOrderId);
    let a = await tx.invoiceAllocation.findFirst({ where: { OR: [{ externalOrderId }, { invoiceId: input.invoiceId }] } });
    if (!a) {
      if (await tx.saleDocument.findUnique({ where: { externalOrderId } })) fail('ORDER_IDENTITY_CONFLICT');
      a = await tx.invoiceAllocation.create({ data: { id: randomUUID(), externalOrderId, invoiceId: input.invoiceId,
        status: 'released', releaseRequestId: input.requestId, releaseReason: input.reason, releasedAt: new Date() } });
    } else {
      if (a.externalOrderId !== externalOrderId || a.invoiceId !== input.invoiceId) fail('INVOICE_IDENTITY_CONFLICT');
      if (a.saleDocumentId !== null) {
        const lockKey = `sale-document:${a.saleDocumentId}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 2))::text`;
        await lockSaleDocument(tx, a.saleDocumentId);
        const doc = await tx.saleDocument.findUniqueOrThrow({ where: { id: a.saleDocumentId } });
        if (doc.orderStatus !== 'cancelled' && !canTransitionOrderStatus(doc.orderStatus, 'cancelled')) fail('INVOICE_RELEASE_FORBIDDEN');
        await releaseInvoiceAllocationInTransaction(tx, doc);
        if (doc.orderStatus !== 'cancelled') {
          const updated = await tx.saleDocument.update({ where: { id: doc.id }, data: { orderStatus: 'cancelled', statusVersion: { increment: 1 } } });
          await enqueueOrderStatusProjection(tx, updated);
        }
      } else if (a.status !== 'released') fail('INVOICE_ALLOCATION_INVALID');
      await tx.invoiceAllocation.update({ where: { id: a.id }, data: { releaseRequestId: input.requestId, releaseReason: a.releaseReason ?? input.reason } });
    }
    return response(await tx.invoiceAllocation.findUniqueOrThrow({ where: { id: a.id }, include: { saleDocument: true } }));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
}

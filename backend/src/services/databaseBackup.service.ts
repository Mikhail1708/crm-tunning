import { Prisma, PrismaClient } from '@prisma/client';
import { newAuthGeneration } from './authRevocation.service';

const tables = {
  users: 'user', categories: 'category', categoryFields: 'categoryField',
  products: 'product', productCategories: 'productCategory', productCharacteristics: 'productCharacteristic',
  clients: 'client', saleDocuments: 'saleDocument', saleDocumentItems: 'saleDocumentItem',
  sales: 'sale', expenses: 'expense', productImages: 'productImage', priceHistory: 'priceHistory',
  inventoryReservations: 'inventoryReservation', inventoryReservationItems: 'inventoryReservationItem',
  crmStatusOutboxEvents: 'crmStatusOutboxEvent',
} as const;
const runtimeKeys = ['productImages', 'priceHistory', 'inventoryReservations', 'inventoryReservationItems', 'crmStatusOutboxEvents'] as const;
const bigintFields: Record<string, string[]> = {
  saleDocuments: ['paidAmountMinor'], inventoryReservations: ['totalMinor', 'paidAmountMinor'],
  inventoryReservationItems: ['unitPriceMinor', 'totalMinor'],
};

export class BackupError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'BackupError'; }
}

// Whole-database administrative replacement: prevent writers/workers from
// inserting children between the safety checks and deletion of their parents.
export async function lockBackupTables(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`LOCK TABLE "User", "Category", "CategoryField", "Product", "ProductCategory",
    "ProductCharacteristic", "Client", "SaleDocument", "SaleDocumentItem", "Sale", "Expense",
    "ProductImage", "PriceHistory", "InventoryReservation", "InventoryReservationItem",
    "CrmStatusOutboxEvent" IN ACCESS EXCLUSIVE MODE`;
}

export async function clearBackupTables(tx: Prisma.TransactionClient) {
  await tx.inventoryReservationItem.deleteMany();
  await tx.inventoryReservation.deleteMany();
  await tx.crmStatusOutboxEvent.deleteMany();
  await tx.saleDocumentItem.deleteMany();
  await tx.sale.deleteMany();
  await tx.saleDocument.deleteMany();
  await tx.priceHistory.deleteMany();
  await tx.productImage.deleteMany();
  await tx.productCharacteristic.deleteMany();
  await tx.productCategory.deleteMany();
  await tx.expense.deleteMany();
  await tx.client.deleteMany();
  await tx.product.deleteMany();
  await tx.categoryField.deleteMany();
  await tx.category.deleteMany();
  await tx.user.deleteMany({ where: { role: { not: 'admin' } } });
}

export async function exportDatabaseBackup(db: PrismaClient) {
  return db.$transaction(async tx => {
    const data: Record<string, any[]> = {};
    for (const [key, model] of Object.entries(tables)) {
      const rows = await (tx[model] as any).findMany();
      data[key] = rows.map((row: any) => {
        const result = { ...row };
        for (const field of bigintFields[key] || []) {
          if (result[field] != null) result[field] = result[field].toString();
        }
        if (key === 'productImages' && result.data != null) result.data = Buffer.from(result.data).toString('base64');
        return result;
      });
    }
    return { version: '4.0', exportedAt: new Date().toISOString(), data };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 });
}

export async function restoreDatabaseBackup(db: PrismaClient, dump: any) {
  if (!dump || !['3.0', '4.0'].includes(dump.version) || !dump.data || typeof dump.data !== 'object') {
    throw new BackupError(400, 'Неверный формат дампа: ожидается версия 3.0 или 4.0');
  }
  const legacy = dump.version === '3.0';
  // A v3 label must never silently discard newer data supplied in the file.
  if (legacy && runtimeKeys.some(key => dump.data[key] !== undefined &&
    (!Array.isArray(dump.data[key]) || dump.data[key].length !== 0))) {
    throw new BackupError(400, 'Runtime tables require backup version 4.0');
  }
  for (const key of Object.keys(tables)) {
    if (legacy && (runtimeKeys as readonly string[]).includes(key)) continue;
    if (!Array.isArray(dump.data[key]) || dump.data[key].some((row: any) => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new BackupError(400, 'Дамп не содержит обязательные таблицы');
    }
  }
  if (legacy && dump.legacyRuntimePolicy !== 'require-empty') {
    throw new BackupError(409, 'Дамп v3 не содержит резервы, outbox, изображения и историю цен. Требуется явное подтверждение legacyRuntimePolicy=require-empty');
  }
  await db.$transaction(async tx => {
    await lockBackupTables(tx);
    if (legacy) {
      for (const key of runtimeKeys) {
        if (await (tx[tables[key]] as any).count()) {
          throw new BackupError(409, 'Восстановление v3 запрещено: отсутствующие в дампе таблицы содержат данные. Сначала нужен полный backup v4');
        }
      }
    }
    await clearBackupTables(tx);
    // Only admins that existed before restore may replace backup identities.
    // Do not mistake an admin just restored from the dump for a preserved one.
    const preservedAdmins = await tx.user.findMany({ where: { role: 'admin' }, orderBy: { id: 'asc' } });
    const adminIds = new Map<number, number>();
    for (const [key, model] of Object.entries(tables)) {
      if (legacy && (runtimeKeys as readonly string[]).includes(key)) continue;
      for (const row of dump.data[key]) {
        const data = { ...row };
        if (key === 'users') {
          if (data.role === 'admin') {
            const existing = preservedAdmins.find(user => user.email === data.email) || preservedAdmins[0];
            if (existing) { adminIds.set(data.id, existing.id); continue; }
          }
          data.authGeneration = newAuthGeneration();
        }
        for (const field of ['createdBy', 'changedBy', 'discountUpdatedBy']) {
          if (adminIds.has(data[field])) data[field] = adminIds.get(data[field]);
        }
        // Prisma distinguishes SQL NULL from JSON null on writes. Both are
        // returned as null by findMany; restore the optional field as SQL NULL.
        if (key === 'products' && data.costBreakdown === null) data.costBreakdown = Prisma.DbNull;
        for (const field of bigintFields[key] || []) {
          if (data[field] != null) {
            if (typeof data[field] === 'number' && !Number.isSafeInteger(data[field])) {
              throw new BackupError(400, 'Large monetary values must be encoded as decimal strings');
            }
            if (!/^-?\d+$/.test(String(data[field]))) throw new BackupError(400, 'Неверное денежное значение в дампе');
            data[field] = BigInt(data[field]);
          }
        }
        if (key === 'productImages' && data.data != null) {
          if (typeof data.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.data)) {
            throw new BackupError(400, 'Неверные данные изображения в дампе');
          }
          data.data = Buffer.from(data.data, 'base64');
        }
        // A delivery claim belongs to a process that is no longer running.
        // Keep immutable event IDs/payloads so website idempotency remains valid.
        if (key === 'crmStatusOutboxEvents' && data.deliveryStatus === 'processing') {
          data.deliveryStatus = 'pending'; data.lockedAt = null;
        }
        await (tx[model] as any).create({ data });
      }
    }
    // IDs are restored explicitly; reset their sequences in this transaction.
    // Table identifiers are a static allowlist, never supplied by the request.
    for (const table of ['User', 'Category', 'CategoryField', 'Product', 'ProductCharacteristic', 'Client', 'SaleDocument', 'SaleDocumentItem', 'Sale', 'Expense', 'ProductImage', 'PriceHistory']) {
      const [row] = await tx.$queryRaw<Array<{ next: number }>>(Prisma.sql`
        SELECT COALESCE(MAX(id), 0) + 1 AS next FROM ${Prisma.raw(`"${table}"`)}`);
      if (!Number.isSafeInteger(row.next) || row.next < 1) throw new BackupError(400, 'Неверная последовательность ID');
      // ALTER RESTART is transactional, unlike setval (which survives rollback).
      await tx.$executeRaw(Prisma.sql`ALTER SEQUENCE ${Prisma.raw(`"${table}_id_seq"`)} RESTART WITH ${Prisma.raw(String(row.next))}`);
    }
  }, { timeout: 120_000 });
}

export async function assertSalesHistoryCanBeCleared(tx: Prisma.TransactionClient) {
  // Bulk history deletion must not discard reservation/payment idempotency or
  // undelivered website status. Use the normal cancellation flow instead.
  if (await tx.inventoryReservation.count() || await tx.crmStatusOutboxEvent.count()) {
    throw new BackupError(409, 'Очистка истории запрещена при наличии резервов или status outbox. Используйте штатную отмену заказов');
  }
}

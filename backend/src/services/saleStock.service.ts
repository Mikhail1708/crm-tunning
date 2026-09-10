import { Prisma } from '@prisma/client';

export class SaleStockError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'SaleStockError';
  }
}

export interface SaleStockItem { productId: number; quantity: number }

export function assertPositiveQuantity(quantity: unknown): asserts quantity is number {
  if (!Number.isInteger(quantity) || (quantity as number) <= 0 || (quantity as number) > 2_147_483_647) {
    throw new SaleStockError(400, 'INVALID_QUANTITY', 'Количество должно быть положительным целым числом');
  }
}

export function assertSaleItems(items: unknown): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new SaleStockError(400, 'INVALID_ITEMS', 'Заказ не может быть пустым');
  }
  const ids = new Set<number>();
  for (const item of items) {
    assertPositiveQuantity(item?.quantity);
    if (!Number.isInteger(item?.productId) || item.productId <= 0 || item.productId > 2_147_483_647) {
      throw new SaleStockError(400, 'INVALID_PRODUCT_ID', 'Неверный ID товара');
    }
    if (ids.has(item.productId)) {
      throw new SaleStockError(400, 'DUPLICATE_PRODUCT', 'Один товар не может повторяться в нескольких строках заказа');
    }
    ids.add(item.productId);
  }
}

// Lock before writing child rows: their FK locks must not precede stock locks.
// The ascending order matches the existing website reservation implementation.
export async function lockStockProducts(tx: Prisma.TransactionClient, ids: number[]): Promise<void> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  if (sorted.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM "Product" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE
  `;
}

export async function lockSaleDocument(tx: Prisma.TransactionClient, id: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "SaleDocument" WHERE id = ${id} FOR UPDATE`;
}

export async function deductSaleStock(tx: Prisma.TransactionClient, items: SaleStockItem[]): Promise<void> {
  assertSaleItems(items);
  await lockStockProducts(tx, items.map(item => item.productId));
  for (const item of [...items].sort((a, b) => a.productId - b.productId)) {
    const result = await tx.product.updateMany({
      where: { id: item.productId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (result.count !== 1) {
      throw new SaleStockError(409, 'INSUFFICIENT_STOCK', `Недостаточно товара на складе: ${item.productId}`);
    }
  }
}

// Caller holds the document row lock and reads its CURRENT items in this transaction.
export async function replaceSaleStock(
  tx: Prisma.TransactionClient, previous: SaleStockItem[], next: SaleStockItem[],
): Promise<void> {
  assertSaleItems(next);
  const deltas = new Map<number, number>();
  for (const item of previous) {
    assertPositiveQuantity(item.quantity);
    deltas.set(item.productId, (deltas.get(item.productId) || 0) - item.quantity);
  }
  for (const item of next) deltas.set(item.productId, (deltas.get(item.productId) || 0) + item.quantity);
  await lockStockProducts(tx, [...deltas.keys()]);
  for (const [productId, delta] of [...deltas].sort(([a], [b]) => a - b)) {
    if (delta > 0) {
      const result = await tx.product.updateMany({
        where: { id: productId, stock: { gte: delta } },
        data: { stock: { decrement: delta } },
      });
      if (result.count !== 1) {
        throw new SaleStockError(409, 'INSUFFICIENT_STOCK', `Недостаточно товара на складе: ${productId}`);
      }
    } else if (delta < 0) {
      await tx.product.update({ where: { id: productId }, data: { stock: { increment: -delta } } });
    }
  }
}

import { PrismaClient } from '@prisma/client';
import { lockStockProducts, SaleStockError } from './saleStock.service';

export async function deleteProductPreservingHistory(db: PrismaClient, productId: number): Promise<void> {
  await db.$transaction(async tx => {
    // This lock also serializes deletion with stock writers and FK insertions.
    // The precheck protects the API even before the Restrict migration is applied.
    await lockStockProducts(tx, [productId]);
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new SaleStockError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден');
    const where = { productId };
    const history = await tx.sale.count({ where })
      + await tx.saleDocumentItem.count({ where })
      + await tx.priceHistory.count({ where })
      + await tx.inventoryReservationItem.count({ where });
    if (history > 0) {
      throw new SaleStockError(409, 'PRODUCT_HAS_HISTORY',
        'Нельзя удалить товар с историей продаж, документов, цен или резервов');
    }
    await tx.product.delete({ where: { id: productId } });
  });
}

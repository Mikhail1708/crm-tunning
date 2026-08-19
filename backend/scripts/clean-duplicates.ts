// scripts/clean-duplicates.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 STARTING CLEANUP OF DUPLICATES BY NAME...');
  console.log('===============================================');

  try {
    // ============================================================
    // 1. ПРОВЕРЯЕМ ТЕКУЩЕЕ СОСТОЯНИЕ
    // ============================================================
    console.log('\n📊 Current state:');
    const before = {
      products: await prisma.product.count(),
      categories: await prisma.category.count(),
      clients: await prisma.client.count(),
      documents: await prisma.saleDocument.count(),
      items: await prisma.saleDocumentItem.count(),
      sales: await prisma.sale.count(),
    };
    console.log('  Before cleanup:', before);

    // ============================================================
    // 2. НАХОДИМ И УДАЛЯЕМ ДУБЛИКАТЫ ПРОДУКТОВ
    // ============================================================
    console.log('\n🔍 Finding duplicate products...');
    
    const duplicateProducts = await prisma.$queryRaw`
      SELECT name, COUNT(*) as count, MIN(id) as keep_id, ARRAY_AGG(id) as ids
      FROM "Product"
      GROUP BY name
      HAVING COUNT(*) > 1
    `;
    
    console.log(`  Found ${(duplicateProducts as any[]).length} duplicate product names`);

    let deletedProducts = 0;
    for (const dup of (duplicateProducts as any[])) {
      const idsToDelete = (dup.ids as number[]).filter((id: number) => id !== dup.keep_id);
      
      if (idsToDelete.length > 0) {
        for (const id of idsToDelete) {
          // Проверяем связанные записи
          const hasItems = await prisma.saleDocumentItem.count({
            where: { productId: id }
          });
          
          const hasSales = await prisma.sale.count({
            where: { productId: id }
          });
          
          const hasChars = await prisma.productCharacteristic.count({
            where: { productId: id }
          });
          
          const catsResult = await prisma.$queryRaw<{ count: number }[]>`
            SELECT COUNT(*) as count FROM "ProductCategory" WHERE "productId" = ${id}
          `;
          const hasCats = Number(catsResult[0]?.count || 0);
          
          const hasImages = await prisma.productImage.count({
            where: { productId: id }
          });
          
          const hasPriceHistory = await prisma.priceHistory.count({
            where: { productId: id }
          });
          
          if (hasItems > 0 || hasSales > 0 || hasChars > 0 || hasCats > 0 || hasImages > 0 || hasPriceHistory > 0) {
            console.log(`  ⚠️ Product ${id} has related records, updating references...`);
            
            // Обновляем SaleDocumentItem
            await prisma.$executeRaw`
              UPDATE "SaleDocumentItem" SET "productId" = ${dup.keep_id} WHERE "productId" = ${id}
            `;
            
            // Обновляем Sale
            await prisma.$executeRaw`
              UPDATE "Sale" SET "productId" = ${dup.keep_id} WHERE "productId" = ${id}
            `;
            
            // Обновляем ProductCharacteristic
            await prisma.$executeRaw`
              UPDATE "ProductCharacteristic" SET "productId" = ${dup.keep_id} WHERE "productId" = ${id}
            `;
            
            // Обновляем ProductCategory - с проверкой на дубликаты
            await prisma.$executeRaw`
              INSERT INTO "ProductCategory" ("productId", "categoryId")
              SELECT ${dup.keep_id}, "categoryId" FROM "ProductCategory" WHERE "productId" = ${id}
              ON CONFLICT ("productId", "categoryId") DO NOTHING
            `;
            await prisma.$executeRaw`
              DELETE FROM "ProductCategory" WHERE "productId" = ${id}
            `;
            
            // Обновляем ProductImage
            await prisma.$executeRaw`
              UPDATE "ProductImage" SET "productId" = ${dup.keep_id} WHERE "productId" = ${id}
            `;
            
            // Обновляем PriceHistory
            await prisma.$executeRaw`
              UPDATE "PriceHistory" SET "productId" = ${dup.keep_id} WHERE "productId" = ${id}
            `;
          }
          
          await prisma.$executeRaw`
            DELETE FROM "Product" WHERE id = ${id}
          `;
          deletedProducts++;
        }
        
        console.log(`  ✅ Removed ${idsToDelete.length} duplicates for "${dup.name}"`);
      }
    }

    // ============================================================
    // 3. НАХОДИМ И УДАЛЯЕМ ДУБЛИКАТЫ КЛИЕНТОВ
    // ============================================================
    console.log('\n👤 Finding duplicate clients...');
    
    const duplicateClients = await prisma.$queryRaw`
      SELECT phone, COUNT(*) as count, MIN(id) as keep_id, ARRAY_AGG(id) as ids
      FROM "Client"
      GROUP BY phone
      HAVING COUNT(*) > 1
    `;
    
    console.log(`  Found ${(duplicateClients as any[]).length} duplicate client phones`);

    let deletedClients = 0;
    for (const dup of (duplicateClients as any[])) {
      const idsToDelete = (dup.ids as number[]).filter((id: number) => id !== dup.keep_id);
      
      if (idsToDelete.length > 0) {
        for (const id of idsToDelete) {
          const clientData = await prisma.client.findUnique({
            where: { id },
            select: { totalOrders: true, totalSpent: true }
          });
          
          const hasOrders = await prisma.saleDocument.count({
            where: { clientId: id }
          });
          
          if (hasOrders > 0) {
            console.log(`  ⚠️ Client ${id} has orders, updating references...`);
            await prisma.$executeRaw`
              UPDATE "SaleDocument" SET "clientId" = ${dup.keep_id} WHERE "clientId" = ${id}
            `;
          }
          
          if (clientData) {
            await prisma.$executeRaw`
              UPDATE "Client" 
              SET "totalOrders" = "totalOrders" + ${clientData.totalOrders},
                  "totalSpent" = "totalSpent" + ${clientData.totalSpent}
              WHERE id = ${dup.keep_id}
            `;
          }
          
          await prisma.$executeRaw`
            DELETE FROM "Client" WHERE id = ${id}
          `;
          deletedClients++;
        }
        console.log(`  ✅ Removed ${idsToDelete.length} duplicates for phone "${dup.phone}"`);
      }
    }

    // ============================================================
    // 4. НАХОДИМ И УДАЛЯЕМ ДУБЛИКАТЫ ДОКУМЕНТОВ
    // ============================================================
    console.log('\n📄 Finding duplicate documents...');
    
    const duplicateDocs = await prisma.$queryRaw`
      SELECT "documentNumber", COUNT(*) as count, MIN(id) as keep_id, ARRAY_AGG(id) as ids
      FROM "SaleDocument"
      GROUP BY "documentNumber"
      HAVING COUNT(*) > 1
    `;
    
    console.log(`  Found ${(duplicateDocs as any[]).length} duplicate document numbers`);

    let deletedDocs = 0;
    for (const dup of (duplicateDocs as any[])) {
      const idsToDelete = (dup.ids as number[]).filter((id: number) => id !== dup.keep_id);
      
      if (idsToDelete.length > 0) {
        for (const id of idsToDelete) {
          const hasItems = await prisma.saleDocumentItem.count({
            where: { documentId: id }
          });
          
          const hasSales = await prisma.sale.count({
            where: { documentId: id }
          });
          
          if (hasItems > 0 || hasSales > 0) {
            console.log(`  ⚠️ Document ${id} has related records, updating references...`);
            await prisma.$executeRaw`
              UPDATE "SaleDocumentItem" SET "documentId" = ${dup.keep_id} WHERE "documentId" = ${id}
            `;
            await prisma.$executeRaw`
              UPDATE "Sale" SET "documentId" = ${dup.keep_id} WHERE "documentId" = ${id}
            `;
          }
          
          await prisma.$executeRaw`
            DELETE FROM "SaleDocument" WHERE id = ${id}
          `;
          deletedDocs++;
        }
        console.log(`  ✅ Removed ${idsToDelete.length} duplicates for "${dup.documentNumber}"`);
      }
    }

    // ============================================================
    // 5. УДАЛЯЕМ ДУБЛИКАТЫ В СВЯЗАННЫХ ТАБЛИЦАХ
    // ============================================================
    console.log('\n🗑️ Cleaning up orphaned records...');
    
    // Удаляем дубликаты ProductCategory
    await prisma.$executeRaw`
      DELETE FROM "ProductCategory" 
      WHERE ("productId", "categoryId") IN (
        SELECT "productId", "categoryId" FROM (
          SELECT "productId", "categoryId", ROW_NUMBER() OVER (PARTITION BY "productId", "categoryId" ORDER BY "productId") as rn
          FROM "ProductCategory"
        ) t
        WHERE t.rn > 1
      )
    `;

    // Удаляем дубликаты ProductCharacteristic
    await prisma.$executeRaw`
      DELETE FROM "ProductCharacteristic" 
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "productId", "fieldId" ORDER BY id) as rn
          FROM "ProductCharacteristic"
        ) t
        WHERE t.rn > 1
      )
    `;

    // ============================================================
    // 6. ОБНОВЛЯЕМ SEQUENCES
    // ============================================================
    console.log('\n🔄 Fixing sequences...');
    await prisma.$executeRaw`
      SELECT setval('"Product_id_seq"', COALESCE((SELECT MAX(id) FROM "Product"), 1), true)
    `;
    await prisma.$executeRaw`
      SELECT setval('"Client_id_seq"', COALESCE((SELECT MAX(id) FROM "Client"), 1), true)
    `;
    await prisma.$executeRaw`
      SELECT setval('"SaleDocument_id_seq"', COALESCE((SELECT MAX(id) FROM "SaleDocument"), 1), true)
    `;
    await prisma.$executeRaw`
      SELECT setval('"SaleDocumentItem_id_seq"', COALESCE((SELECT MAX(id) FROM "SaleDocumentItem"), 1), true)
    `;
    await prisma.$executeRaw`
      SELECT setval('"Sale_id_seq"', COALESCE((SELECT MAX(id) FROM "Sale"), 1), true)
    `;

    // ============================================================
    // 7. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
    // ============================================================
    console.log('\n📊 After cleanup:');
    const after = {
      products: await prisma.product.count(),
      categories: await prisma.category.count(),
      clients: await prisma.client.count(),
      documents: await prisma.saleDocument.count(),
      items: await prisma.saleDocumentItem.count(),
      sales: await prisma.sale.count(),
    };
    console.log('  After cleanup:', after);

    console.log('\n✅ Cleanup completed successfully!');
    console.log(`📊 Removed:
      - Products: ${before.products - after.products}
      - Clients: ${before.clients - after.clients}
      - Documents: ${before.documents - after.documents}
    `);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
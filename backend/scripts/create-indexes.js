const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const indexes = [
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_document_sale_date ON "SaleDocument"("saleDate")`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_document_client_id ON "SaleDocument"("clientId")`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_document_payment_status ON "SaleDocument"("paymentStatus")`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_item_document_id ON "SaleDocumentItem"("documentId")`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_item_product_id ON "SaleDocumentItem"("productId")`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_stock ON "Product"("stock")`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_article ON "Product"("article")`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_phone ON "Client"("phone")`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_document_payment_date ON "SaleDocument"("paymentStatus", "saleDate")`,
];

async function createIndexes() {
  console.log('🚀 Creating indexes...');
  
  for (const sql of indexes) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`✅ Created: ${sql.substring(0, 50)}...`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⚠️ Index already exists, skipping...`);
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log('✅ Indexes created successfully!');
  await prisma.$disconnect();
}

createIndexes().catch(console.error);
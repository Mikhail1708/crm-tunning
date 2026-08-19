// scripts/migrate-full.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting FULL migration...');
  console.log('====================================');

  // 1. Читаем JSON
  const filePath = path.join(__dirname, '../database_dump_2026-08-11T05-36-52.json');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Файл не найден: ${filePath}`);
    console.log('📁 Убедитесь, что файл лежит в корне backend');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const dump = JSON.parse(fileContent);

  console.log(`📄 JSON loaded: ${dump.data.users?.length || 0} users, ${dump.data.products?.length || 0} products`);

  // ============================================================
  // 2. USER
  // ============================================================
  console.log('\n👤 Migrating users...');
  const userMap = new Map();
  for (const user of dump.data.users || []) {
    try {
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
      });
      if (existing) {
        userMap.set(user.id, existing.id);
        continue;
      }
      const created = await prisma.user.create({
        data: {
          email: user.email,
          password: user.password,
          name: user.name,
          role: user.role || 'manager',
          createdAt: new Date(user.createdAt || new Date()),
          updatedAt: new Date(user.updatedAt || new Date()),
        },
      });
      userMap.set(user.id, created.id);
      console.log(`  ✅ ${user.email}`);
    } catch (err) {
      console.log(`  ❌ ${user.email}:`, err);
    }
  }
  console.log(`  ✅ ${userMap.size} users`);

  // ============================================================
  // 3. CATEGORY
  // ============================================================
  console.log('\n📂 Migrating categories...');
  const categoryMap = new Map();
  for (const cat of dump.data.categories || []) {
    try {
      const existing = await prisma.category.findUnique({
        where: { name: cat.name },
      });
      if (existing) {
        categoryMap.set(cat.id, existing.id);
        continue;
      }
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          description: cat.description || '',
          icon: cat.icon || undefined,
          sortOrder: cat.sortOrder || 0,
          isActive: cat.isActive !== undefined ? cat.isActive : true,
          createdAt: new Date(cat.createdAt || new Date()),
          updatedAt: new Date(cat.updatedAt || new Date()),
        },
      });
      categoryMap.set(cat.id, created.id);
      console.log(`  ✅ ${cat.name}`);
    } catch (err) {
      console.log(`  ❌ ${cat.name}:`, err);
    }
  }
  console.log(`  ✅ ${categoryMap.size} categories`);

  // ============================================================
  // 4. CATEGORY FIELD
  // ============================================================
  console.log('\n📋 Migrating category fields...');
  const fieldMap = new Map();
  for (const field of dump.data.categoryFields || []) {
    try {
      const categoryId = categoryMap.get(field.categoryId);
      if (!categoryId) continue;
      const created = await prisma.categoryField.create({
        data: {
          categoryId: categoryId,
          name: field.name,
          fieldType: field.fieldType,
          isRequired: field.isRequired || false,
          sortOrder: field.sortOrder || 0,
          options: field.options || null,
          createdAt: new Date(field.createdAt || new Date()),
          updatedAt: new Date(field.updatedAt || new Date()),
        },
      });
      fieldMap.set(field.id, created.id);
    } catch (err) {
      // пропускаем
    }
  }
  console.log(`  ✅ ${fieldMap.size} fields`);

  // ============================================================
  // 5. PRODUCT
  // ============================================================
  console.log('\n📦 Migrating products...');
  const productMap = new Map();
  for (const product of dump.data.products || []) {
    try {
      const created = await prisma.product.create({
        data: {
          name: product.name,
          article: product.article || undefined,
          cost_price: product.cost_price || 0,
          retail_price: product.retail_price || 0,
          description: product.description || undefined,
          stock: product.stock || 0,
          min_stock: product.min_stock || 5,
          image_url: product.image_url || undefined,
          costBreakdown: product.costBreakdown || [],
          createdAt: new Date(product.createdAt || new Date()),
          updatedAt: new Date(product.updatedAt || new Date()),
        },
      });
      productMap.set(product.id, created.id);
      if (productMap.size % 20 === 0) {
        console.log(`  ✅ ${productMap.size} products processed`);
      }
    } catch (err) {
      console.log(`  ❌ ${product.name}:`, err);
    }
  }
  console.log(`  ✅ ${productMap.size} products`);

  // ============================================================
  // 6. PRODUCT CATEGORY
  // ============================================================
  console.log('\n🔗 Migrating product-category relations...');
  let relCount = 0;
  for (const rel of dump.data.productCategories || []) {
    try {
      const productId = productMap.get(rel.productId);
      const categoryId = categoryMap.get(rel.categoryId);
      if (!productId || !categoryId) continue;
      await prisma.$executeRaw`
        INSERT INTO "ProductCategory" ("productId", "categoryId")
        VALUES (${productId}, ${categoryId})
        ON CONFLICT ("productId", "categoryId") DO NOTHING
      `;
      relCount++;
    } catch (err) {
      // пропускаем
    }
  }
  console.log(`  ✅ ${relCount} relations`);

  // ============================================================
  // 7. PRODUCT CHARACTERISTIC
  // ============================================================
  console.log('\n🔖 Migrating product characteristics...');
  let charCount = 0;
  for (const char of dump.data.productCharacteristics || []) {
    try {
      const productId = productMap.get(char.productId);
      const fieldId = fieldMap.get(char.fieldId);
      if (!productId || !fieldId) continue;
      await prisma.productCharacteristic.upsert({
        where: {
          productId_fieldId: { productId, fieldId },
        },
        update: {
          value: char.value,
        },
        create: {
          productId,
          fieldId,
          value: char.value,
          createdAt: new Date(char.createdAt || new Date()),
          updatedAt: new Date(char.updatedAt || new Date()),
        },
      });
      charCount++;
    } catch (err) {
      // пропускаем
    }
  }
  console.log(`  ✅ ${charCount} characteristics`);

  // ============================================================
  // 8. CLIENT
  // ============================================================
  console.log('\n👤 Migrating clients...');
  const clientMap = new Map();
  for (const client of dump.data.clients || []) {
    try {
      const existing = await prisma.client.findUnique({
        where: { phone: client.phone },
      });
      if (existing) {
        clientMap.set(client.id, existing.id);
        continue;
      }
      const created = await prisma.client.create({
        data: {
          firstName: client.firstName || 'Клиент',
          lastName: client.lastName || undefined,
          middleName: client.middleName || undefined,
          phone: client.phone,
          email: client.email || undefined,
          birthDate: client.birthDate ? new Date(client.birthDate) : undefined,
          address: client.address || undefined,
          city: client.city || undefined,
          passport: client.passport || undefined,
          driverLicense: client.driverLicense || undefined,
          carModel: client.carModel || undefined,
          carYear: client.carYear || undefined,
          carVin: client.carVin || undefined,
          carNumber: client.carNumber || undefined,
          notes: client.notes || undefined,
          totalOrders: client.totalOrders || 0,
          totalSpent: client.totalSpent || 0,
          discountPercent: client.discountPercent || 0,
          discountUpdatedAt: client.discountUpdatedAt ? new Date(client.discountUpdatedAt) : undefined,
          discountUpdatedBy: client.discountUpdatedBy ? userMap.get(client.discountUpdatedBy) : undefined,
          createdAt: new Date(client.createdAt || new Date()),
          updatedAt: new Date(client.updatedAt || new Date()),
        },
      });
      clientMap.set(client.id, created.id);
      if (clientMap.size % 20 === 0) {
        console.log(`  ✅ ${clientMap.size} clients processed`);
      }
    } catch (err) {
      console.log(`  ❌ ${client.firstName}:`, err);
    }
  }
  console.log(`  ✅ ${clientMap.size} clients`);

  // ============================================================
  // 9. SALE DOCUMENT
  // ============================================================
  console.log('\n📄 Migrating sale documents...');
  const documentMap = new Map();
  for (const doc of dump.data.saleDocuments || []) {
    try {
      // Проверяем, существует ли уже документ с таким номером
      const existing = await prisma.saleDocument.findUnique({
        where: { documentNumber: doc.documentNumber },
      });
      if (existing) {
        documentMap.set(doc.id, existing.id);
        continue;
      }

      const created = await prisma.saleDocument.create({
        data: {
          documentNumber: doc.documentNumber,
          documentType: doc.documentType || 'order',
          clientId: doc.clientId ? clientMap.get(doc.clientId) : undefined,
          clientName: doc.clientName || undefined,
          clientPhone: doc.clientPhone || undefined,
          customerName: doc.customerName || undefined,
          customerPhone: doc.customerPhone || undefined,
          customerEmail: doc.customerEmail || undefined,
          customerAddress: doc.customerAddress || undefined,
          description: doc.description || undefined,
          subtotal: doc.subtotal || 0,
          discount: doc.discount || 0,
          total: doc.total || 0,
          paymentMethod: doc.paymentMethod || 'cash',
          paymentStatus: doc.paymentStatus || 'paid',
          orderStatus: doc.orderStatus || 'shipped',
          saleDate: new Date(doc.saleDate || new Date()),
          createdAt: new Date(doc.createdAt || new Date()),
          updatedAt: new Date(doc.updatedAt || new Date()),
          createdBy: doc.createdBy ? userMap.get(doc.createdBy) : undefined,
          sellerName: doc.sellerName || undefined,
          source: doc.source || 'instore',
        },
      });
      documentMap.set(doc.id, created.id);
      if (documentMap.size % 50 === 0) {
        console.log(`  ✅ ${documentMap.size} documents processed`);
      }
    } catch (err) {
      console.log(`  ❌ ${doc.documentNumber}:`, err);
    }
  }
  console.log(`  ✅ ${documentMap.size} documents`);

  // ============================================================
  // 10. SALE DOCUMENT ITEMS
  // ============================================================
  console.log('\n📦 Migrating sale document items...');
  let itemCount = 0;
  for (const item of dump.data.saleDocumentItems || []) {
    try {
      const documentId = documentMap.get(item.documentId);
      const productId = productMap.get(item.productId);
      if (!documentId || !productId) continue;
      await prisma.saleDocumentItem.create({
        data: {
          documentId: documentId,
          productId: productId,
          productName: item.productName || 'Товар',
          productArticle: item.productArticle || '',
          quantity: item.quantity || 1,
          price: item.price || 0,
          cost_price: item.cost_price || 0,
          total: item.total || 0,
          createdAt: new Date(item.createdAt || new Date()),
        },
      });
      itemCount++;
    } catch (err) {
      // пропускаем
    }
  }
  console.log(`  ✅ ${itemCount} items`);

  // ============================================================
  // 11. SALE
  // ============================================================
  console.log('\n💰 Migrating sales...');
  let saleCount = 0;
  for (const sale of dump.data.sales || []) {
    try {
      const productId = productMap.get(sale.productId);
      if (!productId) continue;
      await prisma.sale.create({
        data: {
          productId: productId,
          quantity: sale.quantity || 1,
          selling_price: sale.selling_price || 0,
          total_cost: sale.total_cost || 0,
          total_revenue: sale.total_revenue || 0,
          profit: sale.profit || 0,
          customer_name: sale.customer_name || undefined,
          customer_phone: sale.customer_phone || undefined,
          sale_date: new Date(sale.sale_date || new Date()),
          createdAt: new Date(sale.createdAt || new Date()),
          documentId: sale.documentId ? documentMap.get(sale.documentId) : undefined,
        },
      });
      saleCount++;
    } catch (err) {
      // пропускаем
    }
  }
  console.log(`  ✅ ${saleCount} sales`);

  // ============================================================
  // 12. EXPENSE
  // ============================================================
  console.log('\n💸 Migrating expenses...');
  for (const exp of dump.data.expenses || []) {
    try {
      await prisma.expense.create({
        data: {
          name: exp.name || 'Расход',
          amount: exp.amount || 0,
          category: exp.category || 'other',
          description: exp.description || undefined,
          expense_date: new Date(exp.expense_date || new Date()),
          createdAt: new Date(exp.createdAt || new Date()),
        },
      });
    } catch (err) {
      // пропускаем
    }
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log('\n====================================');
  console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('====================================');
  console.log(`📊 Summary:
    - Users: ${dump.data.users?.length || 0}
    - Categories: ${dump.data.categories?.length || 0}
    - Products: ${dump.data.products?.length || 0}
    - Clients: ${dump.data.clients?.length || 0}
    - Documents: ${dump.data.saleDocuments?.length || 0}
    - Sales: ${dump.data.sales?.length || 0}
  `);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
/* restore-local-crm.js
   Restores the LOCAL CRM core data from database_dump_2026-09-08T02-32-04.json.
   Run via restore-local-crm.ps1 from C:\Projects\crm-project\backend.
*/
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function parseDatabaseUrl(raw) {
  if (!raw) fail('DATABASE_URL отсутствует в backend/.env');
  let u;
  try { u = new URL(raw); } catch { fail('DATABASE_URL имеет неверный формат'); }
  return {
    protocol: u.protocol,
    host: u.hostname,
    port: u.port || '5432',
    database: u.pathname.replace(/^\/+/, '').split('?')[0],
    user: decodeURIComponent(u.username || ''),
  };
}

const dumpPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, 'database_dump_2026-09-08T02-32-04.json');

const expected = {
  users: 3,
  products: 93,
  categories: 16,
  categoryFields: 3,
  productCharacteristics: 40,
  sales: 295,
  saleDocuments: 151,
  saleDocumentItems: 250,
  expenses: 0,
  clients: 112,
  productCategories: 164,
};

function dt(value) {
  return value == null ? null : new Date(value);
}

function jsonValue(value) {
  return value == null ? Prisma.DbNull : value;
}

async function resetSequence(tx, table) {
  const sql = `
    SELECT setval(
      pg_get_serial_sequence('"${table}"', 'id'),
      COALESCE((SELECT MAX(id) FROM "${table}"), 1),
      (SELECT COUNT(*) > 0 FROM "${table}")
    )
  `;
  await tx.$queryRawUnsafe(sql);
}

async function main() {
  const db = parseDatabaseUrl(process.env.DATABASE_URL);

  if (!['localhost', '127.0.0.1', '::1'].includes(db.host)) {
    fail(`ОТКАЗ: DATABASE_URL указывает не на localhost: ${db.host}`);
  }
  if (db.database !== 'crm_db') {
    fail(`ОТКАЗ: ожидалась локальная БД crm_db, фактически: ${db.database}`);
  }

  const info = await prisma.$queryRawUnsafe(
    `SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port`
  );
  const current = info[0] || {};
  if (current.database !== 'crm_db') fail(`Подключение установлено к неожиданной БД: ${current.database}`);

  console.log('✅ LOCAL CRM database confirmed');
  console.log(`   DATABASE: ${current.database}`);
  console.log(`   HOST:     ${db.host}`);
  console.log(`   PORT:     ${db.port}`);

  if (!fs.existsSync(dumpPath)) fail(`JSON dump не найден: ${dumpPath}`);

  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  if (dump.version !== '3.0') fail(`Ожидался dump version 3.0, получен: ${dump.version}`);

  const d = dump.data || {};
  for (const [name, count] of Object.entries(expected)) {
    if (!Array.isArray(d[name])) fail(`В dump отсутствует массив data.${name}`);
    if (d[name].length !== count) {
      fail(`Неверное количество ${name}: ожидалось ${count}, в dump ${d[name].length}`);
    }
  }

  console.log('\n📦 Dump verified:');
  console.table(Object.fromEntries(Object.keys(expected).map(k => [k, d[k].length])));

  const productIds = d.products.map(x => x.id);
  const userIds = d.users.map(x => x.id);

  const danglingCreatedBy = d.saleDocuments.filter(
    x => x.createdBy != null && !userIds.includes(x.createdBy)
  );
  if (danglingCreatedBy.length) {
    console.log('\n⚠️ Historical dangling createdBy references found:');
    for (const x of danglingCreatedBy) {
      console.log(`   SaleDocument id=${x.id} number=${x.documentNumber}: createdBy=${x.createdBy} -> NULL`);
    }
  }

  console.log('\n🔄 Import started...');

  await prisma.$transaction(async (tx) => {
    // Clear snapshot-owned relations in FK-safe order.
    // ProductImage is intentionally PRESERVED for product IDs that remain in the snapshot.
    await tx.crmStatusOutboxEvent.deleteMany({});
    await tx.inventoryReservationItem.deleteMany({});
    await tx.inventoryReservation.deleteMany({});
    await tx.saleDocumentItem.deleteMany({});
    await tx.sale.deleteMany({});
    await tx.saleDocument.deleteMany({});
    await tx.productCharacteristic.deleteMany({});
    await tx.productCategory.deleteMany({});
    await tx.categoryField.deleteMany({});
    await tx.category.deleteMany({});
    await tx.expense.deleteMany({});
    await tx.client.deleteMany({});
    await tx.priceHistory.deleteMany({});

    // Remove products/users that no longer exist in authoritative snapshot.
    // Cascades remove dependent rows only for obsolete products.
    await tx.product.deleteMany({ where: { id: { notIn: productIds } } });
    await tx.user.deleteMany({ where: { id: { notIn: userIds } } });

    // Users
    for (const u of d.users) {
      const row = {
        email: u.email,
        password: u.password,
        name: u.name,
        role: u.role,
        createdAt: dt(u.createdAt),
        updatedAt: dt(u.updatedAt),
      };
      await tx.user.upsert({
        where: { id: u.id },
        create: { id: u.id, ...row },
        update: row,
      });
    }

    // Products - upsert to preserve ProductImage rows for existing product IDs.
    for (const p of d.products) {
      const row = {
        name: p.name,
        article: p.article,
        cost_price: p.cost_price,
        retail_price: p.retail_price,
        description: p.description,
        stock: p.stock,
        min_stock: p.min_stock,
        image_url: p.image_url,
        costBreakdown: jsonValue(p.costBreakdown),
        createdAt: dt(p.createdAt),
        updatedAt: dt(p.updatedAt),
      };
      await tx.product.upsert({
        where: { id: p.id },
        create: { id: p.id, ...row },
        update: row,
      });
    }

    if (d.categories.length) await tx.category.createMany({
      data: d.categories.map(x => ({
        id: x.id,
        name: x.name,
        description: x.description,
        icon: x.icon,
        sortOrder: x.sortOrder,
        isActive: x.isActive,
        createdAt: dt(x.createdAt),
        updatedAt: dt(x.updatedAt),
      }))
    });

    if (d.categoryFields.length) await tx.categoryField.createMany({
      data: d.categoryFields.map(x => ({
        id: x.id,
        categoryId: x.categoryId,
        name: x.name,
        fieldType: x.fieldType,
        isRequired: x.isRequired,
        sortOrder: x.sortOrder,
        options: x.options,
        createdAt: dt(x.createdAt),
        updatedAt: dt(x.updatedAt),
      }))
    });

    if (d.productCategories.length) await tx.productCategory.createMany({
      data: d.productCategories
    });

    if (d.productCharacteristics.length) await tx.productCharacteristic.createMany({
      data: d.productCharacteristics.map(x => ({
        id: x.id,
        productId: x.productId,
        fieldId: x.fieldId,
        value: x.value,
        createdAt: dt(x.createdAt),
        updatedAt: dt(x.updatedAt),
      }))
    });

    if (d.clients.length) await tx.client.createMany({
      data: d.clients.map(x => ({
        id: x.id,
        firstName: x.firstName,
        lastName: x.lastName,
        middleName: x.middleName,
        phone: x.phone,
        email: x.email,
        preferredContact: x.preferredContact ?? null,
        birthDate: dt(x.birthDate),
        address: x.address,
        city: x.city,
        passport: x.passport,
        driverLicense: x.driverLicense,
        carModel: x.carModel,
        carYear: x.carYear,
        carVin: x.carVin,
        carNumber: x.carNumber,
        notes: x.notes,
        totalOrders: x.totalOrders,
        totalSpent: x.totalSpent,
        discountPercent: x.discountPercent,
        discountUpdatedAt: dt(x.discountUpdatedAt),
        discountUpdatedBy: x.discountUpdatedBy,
        createdAt: dt(x.createdAt),
        updatedAt: dt(x.updatedAt),
      }))
    });

    if (d.saleDocuments.length) await tx.saleDocument.createMany({
      data: d.saleDocuments.map(x => ({
        id: x.id,
        documentNumber: x.documentNumber,
        externalOrderId: x.externalOrderId ?? null,
        externalPayloadHash: x.externalPayloadHash ?? null,
        externalPaymentId: x.externalPaymentId ?? null,
        paidAmountMinor: x.paidAmountMinor == null ? null : BigInt(x.paidAmountMinor),
        paymentCurrency: x.paymentCurrency ?? null,
        documentType: x.documentType,
        clientId: x.clientId,
        clientName: x.clientName,
        clientPhone: x.clientPhone,
        customerName: x.customerName,
        customerPhone: x.customerPhone,
        customerEmail: x.customerEmail,
        customerAddress: x.customerAddress,
        contactMethod: x.contactMethod ?? null,
        deliveryMethod: x.deliveryMethod ?? null,
        deliveryProvider: x.deliveryProvider ?? null,
        description: x.description,
        subtotal: x.subtotal,
        discount: x.discount,
        total: x.total,
        paymentMethod: x.paymentMethod,
        paymentStatus: x.paymentStatus,
        orderStatus: x.orderStatus,
        statusVersion: x.statusVersion ?? 0,
        cancellationRequestId: x.cancellationRequestId ?? null,
        cancellationDecision: x.cancellationDecision ?? null,
        cancellationReasonCode: x.cancellationReasonCode ?? null,
        cancellationReason: x.cancellationReason ?? null,
        cancellationRequestedAt: dt(x.cancellationRequestedAt),
        cancellationDecidedAt: dt(x.cancellationDecidedAt),
        saleDate: dt(x.saleDate),
        createdAt: dt(x.createdAt),
        updatedAt: dt(x.updatedAt),
        // Dump v3.0 contains one historical document whose createdBy points to
        // a user that is not present in the authoritative users snapshot.
        // createdBy is nullable in Prisma, so do not invent a ghost CRM user:
        // preserve the document and sellerName, but drop only the dangling FK.
        createdBy: x.createdBy != null && userIds.includes(x.createdBy) ? x.createdBy : null,
        sellerName: x.sellerName,
        source: x.source ?? null,
      }))
    });

    if (d.saleDocumentItems.length) await tx.saleDocumentItem.createMany({
      data: d.saleDocumentItems.map(x => ({
        id: x.id,
        documentId: x.documentId,
        productId: x.productId,
        productName: x.productName,
        productArticle: x.productArticle,
        quantity: x.quantity,
        price: x.price,
        cost_price: x.cost_price,
        total: x.total,
        createdAt: dt(x.createdAt),
      }))
    });

    if (d.sales.length) await tx.sale.createMany({
      data: d.sales.map(x => ({
        id: x.id,
        productId: x.productId,
        quantity: x.quantity,
        selling_price: x.selling_price,
        total_cost: x.total_cost,
        total_revenue: x.total_revenue,
        profit: x.profit,
        customer_name: x.customer_name,
        customer_phone: x.customer_phone,
        sale_date: dt(x.sale_date),
        createdAt: dt(x.createdAt),
        documentId: x.documentId,
      }))
    });

    if (d.expenses.length) await tx.expense.createMany({
      data: d.expenses.map(x => ({
        id: x.id,
        name: x.name,
        amount: x.amount,
        category: x.category,
        description: x.description,
        expense_date: dt(x.expense_date),
        createdAt: dt(x.createdAt),
      }))
    });

    for (const table of [
      'User', 'Product', 'Category', 'CategoryField',
      'ProductCharacteristic', 'Client', 'SaleDocument',
      'SaleDocumentItem', 'Sale', 'Expense'
    ]) {
      await resetSequence(tx, table);
    }
  }, { timeout: 120000, maxWait: 10000 });

  console.log('\n✅ Import transaction committed.');

  const dbCounts = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    categories: await prisma.category.count(),
    categoryFields: await prisma.categoryField.count(),
    productCharacteristics: await prisma.productCharacteristic.count(),
    sales: await prisma.sale.count(),
    saleDocuments: await prisma.saleDocument.count(),
    saleDocumentItems: await prisma.saleDocumentItem.count(),
    expenses: await prisma.expense.count(),
    clients: await prisma.client.count(),
    productCategories: await prisma.productCategory.count(),
  };

  console.log('\n🔎 JSON vs DB:');
  let mismatch = false;
  for (const name of Object.keys(expected)) {
    const ok = dbCounts[name] === d[name].length;
    if (!ok) mismatch = true;
    console.log(`${ok ? '✅' : '❌'} ${name.padEnd(26)} JSON=${String(d[name].length).padStart(4)}  DB=${String(dbCounts[name]).padStart(4)}`);
  }
  if (mismatch) fail('После импорта обнаружено несовпадение количества записей.');

  const samples = await prisma.product.findMany({
    where: { id: { in: [262, 34, 42] } },
    select: { id: true, name: true, article: true, stock: true, cost_price: true, retail_price: true },
    orderBy: { id: 'asc' },
  });

  console.log('\n🧪 Sample products:');
  console.table(samples);

  const wanted = new Map(d.products.filter(x => [262,34,42].includes(x.id)).map(x => [x.id, x]));
  for (const row of samples) {
    const src = wanted.get(row.id);
    for (const key of ['name','article','stock','cost_price','retail_price']) {
      if (row[key] !== src[key]) fail(`Sample mismatch: product ${row.id}, field ${key}`);
    }
  }
  if (samples.length !== 3) fail('Не найдены все 3 sample product.');

  console.log('\n🎉 SUCCESS: локальная crm_db заполнена актуальным snapshot.');
  console.log('ℹ️ ProductImage сохранены для товаров, ID которых присутствуют в dump.');
  console.log('ℹ️ PriceHistory / reservations / CRM status outbox очищены как локальные производные данные.');
}

main()
  .catch(err => {
    console.error('\n❌ RESTORE FAILED');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

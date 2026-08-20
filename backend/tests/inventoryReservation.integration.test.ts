import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import {
  consumeInventoryReservation,
  createInventoryReservation,
  releaseInventoryReservation,
} from '../src/controllers/inventoryReservations.controller';

const runDatabaseTests = process.env.RUN_RESERVATION_DB_TESTS === '1';
const prisma = new PrismaClient();

const invoke = async (handler: Function, body: any, params: Record<string, string> = {}) => {
  let statusCode = 200;
  let responseBody: any;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: any) {
      responseBody = value;
      return this;
    },
  };
  await handler({ body, params } as any, response as any);
  return { statusCode, body: responseBody };
};

test('concurrent reservations cannot allocate the last unit twice', {
  skip: !runDatabaseTests && 'set RUN_RESERVATION_DB_TESTS=1 with an isolated migrated test database',
}, async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const product = await prisma.product.create({
    data: { name: `reservation-test-${suffix}`, article: `reservation-${suffix}`, cost_price: 50, retail_price: 100, stock: 1 },
  });
  const orderIds = [`reserve-a:${suffix}`, `reserve-b:${suffix}`];
  try {
    const results = await Promise.all(orderIds.map(externalOrderId => invoke(createInventoryReservation, {
      externalOrderId,
      currency: 'RUB',
      items: [{ productId: product.id, quantity: 1 }],
    })));
    assert.deepEqual(results.map(result => result.statusCode).sort(), [201, 409]);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 0);

    const successful = results.find(result => result.statusCode === 201)!;
    const released = await invoke(
      releaseInventoryReservation,
      {},
      { reservationId: successful.body.reservationId },
    );
    assert.equal(released.statusCode, 200);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 1);
  } finally {
    await prisma.inventoryReservation.deleteMany({ where: { externalOrderId: { in: orderIds } } });
    await prisma.product.delete({ where: { id: product.id } });
  }
});

test('consume uses locked quote after price change and is idempotent', {
  skip: !runDatabaseTests && 'set RUN_RESERVATION_DB_TESTS=1 with an isolated migrated test database',
}, async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const externalOrderId = `quote:${suffix}`;
  const paymentId = `payment-${suffix}`;
  const phone = `7999${String(Date.now()).slice(-7)}`;
  const product = await prisma.product.create({
    data: { name: `quote-test-${suffix}`, article: `quote-${suffix}`, cost_price: 50, retail_price: 100, stock: 1 },
  });
  let reservationId = '';
  try {
    const reserved = await invoke(createInventoryReservation, {
      externalOrderId,
      currency: 'RUB',
      items: [{ productId: product.id, quantity: 1 }],
    });
    assert.equal(reserved.statusCode, 201);
    assert.equal(reserved.body.totalMinor, 10_000);
    reservationId = reserved.body.reservationId;

    await prisma.product.update({ where: { id: product.id }, data: { retail_price: 120 } });
    const payload = {
      externalOrderId,
      paymentId,
      paidAmountMinor: 10_000,
      currency: 'RUB',
      items: [{ productId: product.id, quantity: 1 }],
      client: { firstName: 'Test', lastName: 'Customer', phone },
      deliveryMethod: 'pickup',
    };
    const first = await invoke(consumeInventoryReservation, payload, { reservationId });
    const retry = await invoke(consumeInventoryReservation, payload, { reservationId });
    assert.equal(first.statusCode, 201);
    assert.equal(retry.statusCode, 200);
    assert.equal(first.body.orderId, retry.body.orderId);
    assert.equal(first.body.total, 100);

    const document = await prisma.saleDocument.findUniqueOrThrow({
      where: { id: first.body.orderId },
      include: { items: true },
    });
    assert.equal(document.total, 100);
    assert.equal(document.items[0].price, 100);
    assert.equal(document.externalPaymentId, paymentId);
    assert.equal(document.paidAmountMinor, 10_000n);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 0);
  } finally {
    const reservation = reservationId
      ? await prisma.inventoryReservation.findUnique({ where: { id: reservationId } })
      : null;
    await prisma.inventoryReservation.deleteMany({ where: { externalOrderId } });
    if (reservation?.saleDocumentId) {
      await prisma.sale.deleteMany({ where: { documentId: reservation.saleDocumentId } });
      await prisma.saleDocument.delete({ where: { id: reservation.saleDocumentId } });
    }
    await prisma.client.deleteMany({ where: { phone } });
    await prisma.product.delete({ where: { id: product.id } });
  }
});

test('expired reservation returns a stable terminal code on every consume retry', {
  skip: !runDatabaseTests && 'set RUN_RESERVATION_DB_TESTS=1 with an isolated migrated test database',
}, async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const externalOrderId = `expired:${suffix}`;
  const product = await prisma.product.create({
    data: { name: `expired-test-${suffix}`, article: `expired-${suffix}`, cost_price: 50, retail_price: 100, stock: 1 },
  });
  try {
    const reserved = await invoke(createInventoryReservation, {
      externalOrderId,
      currency: 'RUB',
      items: [{ productId: product.id, quantity: 1 }],
    });
    await prisma.inventoryReservation.update({
      where: { id: reserved.body.reservationId },
      data: { expiresAt: new Date(0) },
    });
    const payload = {
      externalOrderId,
      paymentId: `payment-${suffix}`,
      paidAmountMinor: 10_000,
      currency: 'RUB',
      items: [{ productId: product.id, quantity: 1 }],
      client: { firstName: 'Test', phone: `7998${String(Date.now()).slice(-7)}` },
    };
    const first = await invoke(consumeInventoryReservation, payload, { reservationId: reserved.body.reservationId });
    const retry = await invoke(consumeInventoryReservation, payload, { reservationId: reserved.body.reservationId });
    assert.equal(first.statusCode, 409);
    assert.equal(first.body.code, 'RESERVATION_EXPIRED');
    assert.equal(retry.statusCode, 409);
    assert.equal(retry.body.code, 'RESERVATION_EXPIRED');
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 1);
  } finally {
    await prisma.inventoryReservation.deleteMany({ where: { externalOrderId } });
    await prisma.product.delete({ where: { id: product.id } });
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBankInvoiceIntake, intakeBankInvoice, releaseBankInvoice, releaseInvoiceAllocationInTransaction } from '../src/services/invoiceIntake.service';

const payload = () => ({ contractVersion: 1, requestId: 'bank-invoice-intake:i1', externalOrderId: 'o1', invoiceId: 'i1', invoiceNumber: 'BI-2026-i1', issuedAt: '2026-09-28T00:00:00.000Z', dueAt: '2026-10-01T00:00:00.000Z', amountMinor: '10000', currency: 'RUB', paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', buyerSnapshot: { buyerType: 'legal_entity', legalName: 'Buyer', inn: '7707083893', legalAddress: 'Address', contactName: 'Name', phone: '+79990000000', email: 'buyer@example.test' }, itemsSnapshot: [{ productId: '1', name: 'Snapshot', sku: null, quantity: 1, unitPriceMinor: '10000', totalMinor: '10000' }], delivery: { method: 'pickup', address: null, provider: null, contactMethod: 'phone', comment: null } });

test('strict intake validates identity, arithmetic and unpaid contract before opening a transaction', async () => {
  assert.deepEqual(parseBankInvoiceIntake(payload()), payload());
  for (const change of [ { paymentStatus: 'paid' }, { amountMinor: '1' }, { externalPaymentId: 'fake' }, { sellerSnapshot: {} }, { requestId: 'other' }, { dueAt: 'invalid' }, { currency: 'USD' }, { itemsSnapshot: [...payload().itemsSnapshot, ...payload().itemsSnapshot] }, { buyerSnapshot: { ...payload().buyerSnapshot, inn: 7707083893 } } ]) {
    const db: any = { $transaction: () => assert.fail('invalid contract reached database') };
    await assert.rejects(intakeBankInvoice(db, { ...payload(), ...change }), (e: any) => e.status === 400);
  }
});

test('release rejects unbound identities and unknown fields before opening a transaction', async () => {
  const db: any = { $transaction: () => assert.fail('invalid release reached database') };
  await assert.rejects(releaseBankInvoice(db, 'o1', { invoiceId: 'i1', requestId: 'wrong', reason: 'cancel' }), (e: any) => e.status === 400);
});

test('release restores immutable allocation quantities and forbids paid or committed stock release', async () => {
  let allocation: any = { id: 'a1', status: 'held', payload: { itemsSnapshot: [{ productId: '1', quantity: 3 }] } };
  let stock = 0; let writes = 0;
  const tx: any = { $queryRaw: async () => [], invoiceAllocation: { findUnique: async () => allocation, update: async ({ data }: any) => Object.assign(allocation, data) }, product: { update: async ({ data }: any) => { stock += data.stock.increment; writes++; } }, saleDocumentItem: { findMany: () => assert.fail('mutable document lines used for release') } };
  await releaseInvoiceAllocationInTransaction(tx, { id: 1, paymentStatus: 'unpaid' });
  await releaseInvoiceAllocationInTransaction(tx, { id: 1, paymentStatus: 'unpaid' });
  assert.equal(stock, 3); assert.equal(writes, 1); assert.equal(allocation.status, 'released');
  allocation.status = 'committed';
  await assert.rejects(releaseInvoiceAllocationInTransaction(tx, { id: 1, paymentStatus: 'unpaid' }), (e: any) => e.code === 'INVOICE_RELEASE_FORBIDDEN');
  allocation.status = 'held';
  await assert.rejects(releaseInvoiceAllocationInTransaction(tx, { id: 1, paymentStatus: 'paid' }), (e: any) => e.code === 'INVOICE_RELEASE_FORBIDDEN');
  assert.equal(stock, 3);
});
test('late release cannot cancel shipped CRM order even when SITE state is stale', async () => {
  const tx: any = {
    $queryRaw: async () => [],
    invoiceAllocation: { findFirst: async () => ({ id: 'a1', externalOrderId: 'o1', invoiceId: 'i1', saleDocumentId: 1 }), findUnique: () => assert.fail('release touched allocation') },
    saleDocument: { findUniqueOrThrow: async () => ({ id: 1, orderStatus: 'shipped', paymentStatus: 'unpaid' }) },
    product: { update: () => assert.fail('shipped stock returned') },
  };
  const db: any = { $transaction: (run: Function) => run(tx) };
  await assert.rejects(releaseBankInvoice(db, 'o1', { invoiceId: 'i1', requestId: 'bank-invoice-release:i1', reason: 'cancel' }), (e: any) => e.code === 'INVOICE_RELEASE_FORBIDDEN');
});
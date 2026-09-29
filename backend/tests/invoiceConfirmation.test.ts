import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmBankInvoicePayment } from '../src/services/invoiceConfirmation.service';
import { enqueueOrderStatusProjection } from '../src/services/statusOutbox.service';
import { managerAccess } from '../src/middleware/auth.middleware';
const actor = { id: 7, role: 'manager', name: 'Менеджер' };
function fixture() {
  const allocation: any = { id: 'a', invoiceId: 'i', invoiceNumber: 'BI-1', amountMinor: 10000n, currency: 'RUB', status: 'held', confirmationId: null, confirmedAt: null };
  const document: any = { id: 1, externalOrderId: 'o', documentNumber: 'WEB-1', orderStatus: 'confirmed', statusVersion: 0, paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', customerPhone: '+79990000000', customerName: 'Покупатель', invoiceAllocation: allocation, items: [{ productId: 3, quantity: 2, price: 50, total: 100, cost_price: 20 }] };
  const calls = { sales: 0, client: 0, confirmations: 0, events: [] as any[] };
  const tx: any = { $queryRaw: async () => [], product: { update: () => assert.fail('stock changed'), updateMany: () => assert.fail('stock changed') },
    saleDocument: { findUnique: async () => document, update: async ({ data }: any) => { const { statusVersion, ...rest } = data; Object.assign(document, rest); document.statusVersion += statusVersion.increment; return document; } },
    invoiceAllocation: { findUniqueOrThrow: async () => allocation, update: async ({ data }: any) => { calls.confirmations++; return Object.assign(allocation, data); } },
    client: { upsert: async () => ({ id: 8 }), update: async () => { calls.client++; } }, sale: { createMany: async () => { calls.sales++; } },
    crmStatusOutboxEvent: { upsert: async ({ create }: any) => { calls.events.push(create); } } };
  return { db: { $transaction: (fn: Function) => fn(tx) } as any, tx, document, allocation, calls };
}
test('confirmation audit, accounting and outbox exactly once without changing stock', async () => {
 const f = fixture(); const first = await confirmBankInvoicePayment(f.db, 1, actor); const replay = await confirmBankInvoicePayment(f.db, 1, { ...actor, id: 9 });
 assert.equal(first.idempotent, false); assert.equal(replay.idempotent, true); assert.equal(replay.confirmationId, first.confirmationId);
 assert.equal(f.allocation.status, 'committed'); assert.equal(f.allocation.confirmedById, 7); assert.equal(f.document.paymentStatus, 'paid'); // Bank-invoice confirmation must not populate external online-payment facts.
  assert.equal(f.document.paidAmountMinor ?? null, null); assert.equal(f.document.statusVersion, 1);
 assert.deepEqual([f.calls.sales, f.calls.client, f.calls.confirmations, f.calls.events.length], [1,1,1,1]);
 const p = f.calls.events[0].payload; assert.equal(p.paymentConfirmationId, first.confirmationId); assert.equal(p.amountMinor, '10000'); assert.equal(p.paymentStatus, 'paid'); assert.equal(p.externalOrderId, 'o'); assert.ok(p.paidAt);
 await enqueueOrderStatusProjection(f.tx, { ...f.document, statusVersion: 2, orderStatus: 'assembling' }); assert.equal(f.calls.events[1].payload.paymentConfirmationId, first.confirmationId);
});
test('reject online, released, cancelled and inconsistent confirmation', async () => {
 for (const change of ['online','released','cancelled','committed']) { const f = fixture(); if(change === 'online') f.document.paymentMethod = change; else if(change === 'cancelled') f.document.orderStatus = change; else f.allocation.status = change;
 await assert.rejects(confirmBankInvoicePayment(f.db,1,actor),(e:any)=>e.status===409); assert.equal(f.calls.sales+f.calls.client+f.calls.confirmations+f.calls.events.length,0); }
});
test('manager/admin permission is required by service and route middleware', async () => {
 const db:any = { $transaction:()=>assert.fail('unauthorized DB') }; await assert.rejects(confirmBankInvoicePayment(db,1,{...actor,role:'viewer'}),(e:any)=>e.status===403);
 for(const [user,expected] of [[undefined,401],[{...actor,role:'viewer'},403],[actor,200]] as const) { let status=200; let next=false; const res:any={status:(n:number)=>{status=n;return res;},json:()=>{}};
 await managerAccess({user} as any,res,()=>{next=true;}); assert.equal(status,expected); assert.equal(next,expected===200); }
});
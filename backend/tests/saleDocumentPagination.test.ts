import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { resolveSaleDocumentPage, saleDocumentListQuery, saleDocumentSearchSql, saleDocumentSummary } from '../src/services/saleDocumentList.service';

for (const [input, expected] of [[undefined, 50], ['200', 200], ['1000000000', 200], ['-1', 50], ['0', 50], ['abc', 50], ['1.5', 50], ['Infinity', 50]] as const) {
  test(`document pagination limit ${input}`, () => {
    const query = saleDocumentListQuery({ limit: input, page: '2' });
    assert.equal(query.limit, expected); assert.equal(query.skip, expected);
    assert.deepEqual(query.orderBy, [{ saleDate: 'desc' }, { id: 'desc' }]);
  });
}
for (const page of ['-1', '0', 'abc', '1.5', '10000000000000000000000']) {
  test(`document invalid page ${page}`, () => assert.equal(saleDocumentListQuery({ page }).skip, 0));
}
test('document filters stay on server and apply independently of pagination', () => {
  const query = saleDocumentListQuery({ search: 'needle', paymentStatus: 'paid', orderStatus: 'confirmed', documentType: 'order', startDate: '2026-01-01', endDate: '2026-01-31', clientId: '7', sortBy: 'total', sortOrder: 'asc', page: '3', limit: '10' });
  assert.equal(query.where.clientId, 7); assert.equal(query.where.paymentStatus, 'paid');
  assert.equal(query.where.documentType, 'order'); assert.equal(query.where.orderStatus, 'confirmed');
  assert.equal((query.where.saleDate as any).lte.toISOString(), '2026-01-31T23:59:59.999Z');
  assert.ok(query.where.OR?.some((row: any) => row.items?.some));
  assert.deepEqual(query.orderBy, [{ total: 'asc' }, { id: 'asc' }]);
  assert.equal(query.skip, 20);
  assert.deepEqual(query.where, saleDocumentListQuery({ search: 'needle', paymentStatus: 'paid', orderStatus: 'confirmed', documentType: 'order', startDate: '2026-01-01', endDate: '2026-01-31', clientId: '7' }).where);
});
test('path client ID cannot be replaced by query client ID', () => assert.equal(saleDocumentListQuery({ clientId: '999' }, 7).where.clientId, 7));
test('invalid sort fields fall back to deterministic date order', () => assert.deepEqual(saleDocumentListQuery({ sortBy: 'items', sortOrder: 'wrong' }).orderBy, [{ saleDate: 'desc' }, { id: 'desc' }]));

test('financial summary uses full filtered DB groups, preserving unpaid distinctions and empty totals', async () => {
  const fixture = [
    { clientId: 7, paymentStatus: 'paid', orderStatus: 'confirmed', total: 100 },
    { clientId: 7, paymentStatus: 'paid', orderStatus: 'cancelled', total: 300 },
    { clientId: 7, paymentStatus: 'unpaid', total: 50 },
    { clientId: 7, paymentStatus: 'refunded', total: 80 },
    { clientId: 8, paymentStatus: 'paid', total: 999 },
  ];
  const store = { saleDocument: { aggregate: async (q: any) => {
    assert.deepEqual(q.where.AND[1], { paymentStatus: 'paid', orderStatus: { not: 'cancelled' } });
    const rows = fixture.filter(row => row.clientId === q.where.AND[0].clientId && row.paymentStatus === 'paid' && row.orderStatus !== 'cancelled');
    return { _sum: { total: rows.reduce((sum, row) => sum + row.total, 0) }, _count: rows.length };
  }, groupBy: async (query: any) => {
    assert.deepEqual(query.by, ['paymentStatus']); assert.equal(query.take, undefined); assert.equal(query.skip, undefined);
    const rows = fixture.filter(row => row.clientId === query.where.clientId);
    return [...new Set(rows.map(row => row.paymentStatus))].map(paymentStatus => ({ paymentStatus,
      _count: { _all: rows.filter(row => row.paymentStatus === paymentStatus).length },
      _sum: { total: rows.filter(row => row.paymentStatus === paymentStatus).reduce((sum, row) => sum + row.total, 0) } }));
  } } } as any;
  const summary = await saleDocumentSummary(store, { clientId: 7 });
  assert.deepEqual(summary, { total: 4, count: 4, totalAmount: 100, paidCount: 2, paidTotal: 100, unpaidCount: 1, unpaidTotal: 0, notPaidCount: 2, notPaidTotal: 0, averageCheck: 100 });
  assert.equal((await saleDocumentSummary(store, { clientId: 9 })).averageCheck, 0);
});

test('amount substring search remains parameterized and shared by rows and full totals', async () => {
  const query = { search: '23', clientId: '7', paymentStatus: 'paid', sortBy: 'total', sortOrder: 'asc', page: '2', limit: '1' };
  const calls: Prisma.Sql[] = [];
  // Both totals contain "23", although neither equals the searched number 23.
  const fixture = [{ id: 1, total: 123 }, { id: 2, total: 234 }];
  const store = { $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
    const sql = Prisma.sql(strings, ...values); calls.push(sql);
    assert.match(sql.text, /strpos\(lower\(COALESCE\(d.total::text, ''\)\), lower\(\$\d+\)\) > 0/);
    assert.ok(sql.values.includes('23'));
    assert.ok(sql.values.includes(7));
    if (sql.text.includes('GROUP BY')) return [{ paymentStatus: 'paid', count: 2n, total: 357 }];
    if (sql.text.includes('SUM(d.total)')) { assert.deepEqual(sql.values.slice(-2), ['paid', 'cancelled']); return [{ amount: 357, count: 2n }]; }
    if (sql.text.startsWith('SELECT count')) return [{ total: 2n }];
    assert.deepEqual(sql.values.slice(-2), [1, 1]);
    return fixture.slice(1).map(({ id }) => ({ id }));
  }, saleDocument: { groupBy: async () => { throw new Error('Search totals must use the full SQL filter'); } } } as any;
  const page = await resolveSaleDocumentPage(store, query);
  assert.deepEqual(page.where, { id: { in: [2] } });
  assert.equal(page.skip, 0); assert.equal(page.limit, 1); assert.equal(page.total, 2);
  const summary = await saleDocumentSummary(store, saleDocumentListQuery(query).where, query);
  assert.equal(summary.paidTotal, 357); assert.equal(summary.count, 2);
  assert.deepEqual(calls[0].values.slice(0, -2), calls[1].values);
  assert.deepEqual(calls[1].values, calls[2].values);
  assert.match(calls[0].text, /ORDER BY d.total ASC, d.id ASC LIMIT/);
});

test('search SQL binds untrusted search, honors path ownership and allowlists ordering', () => {
  const payload = "23%'); DROP TABLE anything; --";
  const { filter, order } = saleDocumentSearchSql({ search: payload, clientId: 99, sortBy: payload,
    startDate: '2026-01-01', endDate: '2026-01-31' }, 7);
  assert.ok(filter.values.includes(payload)); assert.ok(!filter.text.includes(payload));
  assert.ok(filter.values.includes(7)); assert.ok(!filter.values.includes(99));
  assert.match(filter.text, /"saleDate" >=/); assert.match(filter.text, /"saleDate" <=/);
  assert.equal(order.text, 'd."saleDate" DESC, d.id DESC');
});

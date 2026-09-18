import { Prisma, PrismaClient } from '@prisma/client';
import { parsePagination } from '../utils/pagination';

export function saleDocumentListQuery(query: Record<string, unknown>, clientId?: number) {
  const { page, limit, skip } = parsePagination(query.page, query.limit, 50, 200);
  const where: Prisma.SaleDocumentWhereInput = {};
  const requestedClient = clientId ?? Number(query.clientId);
  if (Number.isSafeInteger(requestedClient) && requestedClient > 0) where.clientId = requestedClient;
  for (const field of ['paymentStatus', 'documentType', 'orderStatus'] as const) {
    if (typeof query[field] === 'string' && query[field] !== 'all' && query[field]) where[field] = query[field] as string;
  }
  const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined;
  const start = date(query.startDate), end = date(query.endDate);
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(String(query.endDate))) end.setUTCHours(23, 59, 59, 999);
  if (start || end) where.saleDate = { ...(start && { gte: start }), ...(end && { lte: end }) };
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.OR = ['documentNumber', 'customerName', 'customerPhone', 'clientName', 'clientPhone'].map(field => ({ [field]: { contains: search, mode: 'insensitive' } }));
    where.OR.push({ items: { some: { OR: [{ productName: { contains: search, mode: 'insensitive' } }, { productArticle: { contains: search, mode: 'insensitive' } }] } } });
  }
  const sortBy = typeof query.sortBy === 'string' && ['saleDate', 'createdAt', 'total', 'documentNumber'].includes(query.sortBy) ? query.sortBy : 'saleDate';
  const direction: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const orderBy: Prisma.SaleDocumentOrderByWithRelationInput[] = [{ [sortBy]: direction }, { id: direction }];
  return { page, limit, skip, where, orderBy };
}

// Prisma cannot express a substring match on a numeric column. Keep the old
// Sales search semantics in SQL, selecting only one page of IDs for hydration.
export function saleDocumentSearchSql(query: Record<string, unknown>, clientId?: number) {
  const { where, orderBy } = saleDocumentListQuery({ ...query, search: undefined }, clientId);
  const terms: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (where.clientId !== undefined) terms.push(Prisma.sql`d."clientId" = ${where.clientId}`);
  for (const [key, column] of [
    ['paymentStatus', Prisma.sql`d."paymentStatus"`], ['documentType', Prisma.sql`d."documentType"`],
    ['orderStatus', Prisma.sql`d."orderStatus"`],
  ] as const) {
    if (where[key]) terms.push(Prisma.sql`${column} = ${where[key]}`);
  }
  const dates = where.saleDate as Prisma.DateTimeFilter | undefined;
  if (dates?.gte) terms.push(Prisma.sql`d."saleDate" >= ${dates.gte}`);
  if (dates?.lte) terms.push(Prisma.sql`d."saleDate" <= ${dates.lte}`);
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const match = (column: Prisma.Sql) => Prisma.sql`strpos(lower(COALESCE(${column}, '')), lower(${search})) > 0`;
  terms.push(Prisma.sql`(${match(Prisma.sql`d."documentNumber"`)} OR ${match(Prisma.sql`d."customerName"`)}
    OR ${match(Prisma.sql`d."customerPhone"`)} OR ${match(Prisma.sql`d."clientName"`)}
    OR ${match(Prisma.sql`d."clientPhone"`)} OR ${match(Prisma.sql`d.total::text`)}
    OR EXISTS (SELECT 1 FROM "SaleDocumentItem" item WHERE item."documentId" = d.id
      AND (${match(Prisma.sql`item."productName"`)} OR ${match(Prisma.sql`item."productArticle"`)})))`);
  const fields: Record<string, Prisma.Sql> = { saleDate: Prisma.sql`d."saleDate"`, createdAt: Prisma.sql`d."createdAt"`,
    total: Prisma.sql`d.total`, documentNumber: Prisma.sql`d."documentNumber"` };
  const key = Object.keys(orderBy[0])[0];
  const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return { filter: Prisma.sql`${Prisma.join(terms, ' AND ')}`,
    order: Prisma.sql`${fields[key]} ${direction}, d.id ${direction}` };
}

export async function resolveSaleDocumentPage(store: Pick<PrismaClient, '$queryRaw'>, query: Record<string, unknown>, clientId?: number) {
  const parsed = saleDocumentListQuery(query, clientId);
  if (typeof query.search !== 'string' || !query.search.trim()) return { ...parsed, total: undefined as number | undefined };
  const { filter, order } = saleDocumentSearchSql(query, clientId);
  const ids = await store.$queryRaw<Array<{ id: number }>>`SELECT d.id FROM "SaleDocument" d
    WHERE ${filter} ORDER BY ${order} LIMIT ${parsed.limit} OFFSET ${parsed.skip}`;
  const [count] = await store.$queryRaw<Array<{ total: bigint }>>`SELECT count(*) AS total FROM "SaleDocument" d WHERE ${filter}`;
  return { ...parsed, where: { id: { in: ids.map(row => row.id) } }, skip: 0, total: Number(count.total) };
}

// Group only statuses: financial totals use the complete filter, never page rows.
export async function saleDocumentSummary(store: Pick<PrismaClient, 'saleDocument' | '$queryRaw'>, where: Prisma.SaleDocumentWhereInput, query?: Record<string, unknown>) {
  const search = typeof query?.search === 'string' && query.search.trim();
  const groups = search
    ? (await store.$queryRaw<Array<{ paymentStatus: string; count: bigint; total: number }>>`
        SELECT d."paymentStatus", count(*) AS count, sum(d.total) AS total FROM "SaleDocument" d
        WHERE ${saleDocumentSearchSql(query!).filter} GROUP BY d."paymentStatus"`)
        .map(row => ({ paymentStatus: row.paymentStatus, _count: { _all: Number(row.count) }, _sum: { total: row.total } }))
    : await store.saleDocument.groupBy({ by: ['paymentStatus'], where, _count: { _all: true }, _sum: { total: true } });
  let count = 0, totalAmount = 0, paidCount = 0, paidTotal = 0, unpaidCount = 0, unpaidTotal = 0;
  for (const row of groups) {
    const amount = row._sum.total ?? 0;
    count += row._count._all; totalAmount += amount;
    if (row.paymentStatus === 'paid') { paidCount += row._count._all; paidTotal += amount; }
    if (row.paymentStatus === 'unpaid') { unpaidCount += row._count._all; unpaidTotal += amount; }
  }
  return { total: count, count, totalAmount, paidCount, paidTotal, unpaidCount, unpaidTotal,
    notPaidCount: count - paidCount, notPaidTotal: totalAmount - paidTotal, averageCheck: paidCount ? paidTotal / paidCount : 0 };
}

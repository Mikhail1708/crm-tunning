import { Prisma, PrismaClient } from '@prisma/client';
import { paidSaleSql, paidSaleWhere } from '../utils/saleFinancialEligibility';

/** Read current payment/fulfilment evidence, never the legacy Client.totalSpent cache. */
export async function clientFinancialTotals(store: Pick<PrismaClient, 'saleDocument'>, ids: number[]) {
  if (!ids.length) return new Map<number, number>();
  const totals = await store.saleDocument.groupBy({
    by: ['clientId'], where: { ...paidSaleWhere(), clientId: { in: [...new Set(ids)] } },
    _sum: { total: true },
  });
  return new Map(totals.map(row => [row.clientId!, row._sum.total ?? 0]));
}

export async function withClientFinancialTotals<T extends { id: number }>(store: Pick<PrismaClient, 'saleDocument'>, clients: T[]) {
  const totals = await clientFinancialTotals(store, clients.map(client => client.id));
  return clients.map(client => ({ ...client, totalSpent: totals.get(client.id) ?? 0 }));
}

/** A bounded page, ranked by the full live amount rather than sorting a page in JS. */
export async function clientsRankedBySpending(store: Pick<PrismaClient, '$queryRaw'>, options: {
  search?: string; direction?: 'asc' | 'desc'; limit: number; skip?: number;
}) {
  const columns = ['firstName', 'lastName', 'middleName', 'phone', 'email', 'carModel', 'carNumber', 'carVin'];
  const search = options.search ? Prisma.sql`AND (${Prisma.join(columns.map(column =>
    Prisma.sql`strpos(lower(COALESCE(${Prisma.raw('c."' + column + '"')}, '')), lower(${options.search})) > 0`), ' OR ')})` : Prisma.empty;
  const direction = options.direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return store.$queryRaw<Array<{ id: number; totalSpent: number }>>(Prisma.sql`
    SELECT c.id, COALESCE(SUM(d.total), 0) AS "totalSpent"
    FROM "Client" c LEFT JOIN "SaleDocument" d ON d."clientId" = c.id AND ${paidSaleSql('d')}
    WHERE TRUE ${search} GROUP BY c.id
    ORDER BY "totalSpent" ${direction}, c.id ${direction} LIMIT ${options.limit} OFFSET ${options.skip ?? 0}
  `);
}

import { Prisma, PrismaClient } from '@prisma/client';
import { paidSaleSql } from '../utils/saleFinancialEligibility';

// Revenue is aggregated before joining items: an order contributes exactly once.
// Summary uses historical item cost; period stats intentionally use current product cost.
export const paidOrderTotalsQuery = (startDate?: Date, currentCost = false, endDate?: Date) => Prisma.sql`
  WITH orders AS (
    SELECT id, total FROM "SaleDocument"
    WHERE ${paidSaleSql()} AND "documentType" = 'order'
      ${startDate ? Prisma.sql`AND "saleDate" >= ${startDate}` : Prisma.empty}
      ${endDate ? Prisma.sql`AND "saleDate" <= ${endDate}` : Prisma.empty}
  )
  SELECT
    (SELECT COUNT(*)::double precision FROM orders) AS count,
    COALESCE((SELECT SUM(total) FROM orders), 0)::double precision AS revenue,
    COALESCE((SELECT SUM(${currentCost ? Prisma.sql`p.cost_price` : Prisma.sql`i.cost_price`} * i.quantity)
      FROM "SaleDocumentItem" i JOIN orders o ON o.id = i."documentId"
      ${currentCost ? Prisma.sql`JOIN "Product" p ON p.id = i."productId"` : Prisma.empty}
    ), 0)::double precision AS cost
`;

export async function paidOrderTotals(db: Pick<PrismaClient, '$queryRaw'>, startDate?: Date, currentCost = false, endDate?: Date) {
  const [totals] = await db.$queryRaw<Array<{ count: number; revenue: number; cost: number }>>(
    paidOrderTotalsQuery(startDate, currentCost, endDate)
  );
  return totals;
}

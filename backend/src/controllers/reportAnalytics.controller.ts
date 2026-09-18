import { Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestWithUser } from '../types';
import { parsePagination } from '../utils/pagination';

const prisma = new PrismaClient();
const positiveId = (value: unknown) => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined;

export function analyticsDocuments(query: Record<string, unknown>) {
  const start = date(query.startDate), end = date(query.endDate);
  const product = positiveId(query.productId), client = positiveId(query.clientId);
  const city = typeof query.city === 'string' ? query.city : '';
  return Prisma.sql`
    documents AS (
      SELECT d.* FROM "SaleDocument" d LEFT JOIN "Client" c ON c.id = d."clientId"
      WHERE d."paymentStatus" = 'paid'
        ${start ? Prisma.sql`AND d."saleDate" >= ${start}` : Prisma.empty}
        ${end ? Prisma.sql`AND d."saleDate" <= ${end}` : Prisma.empty}
        ${client ? Prisma.sql`AND d."clientId" = ${client}` : Prisma.empty}
        ${product ? Prisma.sql`AND EXISTS (SELECT 1 FROM "SaleDocumentItem" i WHERE i."documentId" = d.id AND i."productId" = ${product})` : Prisma.empty}
        ${city ? Prisma.sql`AND POSITION(LOWER(${city}) IN LOWER(COALESCE(c.city, ''))) > 0` : Prisma.empty}
    ), item_cost AS (
      SELECT i."documentId", SUM(i.cost_price * i.quantity) AS cost
      FROM "SaleDocumentItem" i JOIN documents d ON d.id = i."documentId" GROUP BY i."documentId"
    ), doc_rows AS (
      SELECT d.*, COALESCE(ic.cost, 0) AS "totalCost", d.total - COALESCE(ic.cost, 0) AS "totalProfit",
        COALESCE(NULLIF(BTRIM(c.city), ''), 'Не указан') AS "customerCity"
      FROM documents d LEFT JOIN item_cost ic ON ic."documentId" = d.id LEFT JOIN "Client" c ON c.id = d."clientId"
    )`;
}

export async function getReportAnalytics(req: RequestWithUser, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit, 50, 200);
    const tab = ['overview', 'products', 'clients', 'cities', 'cost'].includes(String(req.query.tab)) ? String(req.query.tab) : 'overview';
    const base = analyticsDocuments(req.query);
    let groups = Prisma.sql`SELECT * FROM doc_rows`;
    let order = Prisma.sql`"saleDate" DESC, id DESC`;
    if (tab === 'products') {
      groups = Prisma.sql`SELECT i."productName" AS name, MIN(i."productId") AS "productId", SUM(i.total) AS revenue,
        SUM((i.price - i.cost_price) * i.quantity) AS profit, SUM(i.quantity)::double precision AS quantity,
        SUM(i.cost_price * i.quantity) AS cost
        FROM "SaleDocumentItem" i JOIN documents d ON d.id = i."documentId" GROUP BY i."productName"`;
      order = Prisma.sql`revenue DESC, name ASC`;
    } else if (tab === 'clients') {
      groups = Prisma.sql`SELECT c.id AS "clientId", CONCAT_WS(' ', c."lastName", c."firstName", NULLIF(c."middleName", '')) AS name,
        c.phone, COALESCE(NULLIF(c.city, ''), '-') AS city, SUM(d.total) AS revenue, SUM(d."totalProfit") AS profit,
        COUNT(*)::double precision AS orders FROM doc_rows d JOIN "Client" c ON c.id = d."clientId"
        GROUP BY c.id`;
      order = Prisma.sql`revenue DESC, "clientId" ASC`;
    } else if (tab === 'cities') {
      groups = Prisma.sql`SELECT "customerCity" AS name, SUM(total) AS revenue, SUM("totalProfit") AS profit,
        COUNT(*)::double precision AS orders FROM doc_rows GROUP BY "customerCity"`;
      order = Prisma.sql`revenue DESC, name ASC`;
    } else if (tab === 'cost') {
      groups = Prisma.sql`SELECT g.*, COALESCE((SELECT json_agg(b) FROM (
        SELECT e->>'name' AS name,
          SUM(CASE WHEN p.cost_price <> 0 THEN (e->>'amount')::double precision / p.cost_price ELSE 0 END) * g."totalCost" AS amount
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p."costBreakdown") = 'array' THEN p."costBreakdown" ELSE '[]'::jsonb END) e
        GROUP BY e->>'name' ORDER BY e->>'name' LIMIT 200
      ) b), '[]'::json) AS breakdown FROM (
        SELECT i."productId", SUM(i.cost_price * i.quantity) AS "totalCost", SUM(i.total) AS "totalRevenue",
          SUM(i.total - i.cost_price * i.quantity) AS "totalProfit", COUNT(*)::double precision AS "salesCount",
          SUM(i.quantity)::double precision AS "quantitySold"
        FROM "SaleDocumentItem" i JOIN documents d ON d.id = i."documentId" GROUP BY i."productId"
      ) g JOIN "Product" p ON p.id = g."productId"`;
      groups = Prisma.sql`SELECT cost.*, p.name AS "productName" FROM (${groups}) cost JOIN "Product" p ON p.id = cost."productId"`;
      order = Prisma.sql`"totalCost" DESC, "productId" ASC`;
    }
    const serializedRows = tab === 'overview' ? Prisma.sql`
      SELECT json_agg(to_jsonb(r) || jsonb_build_object(
        'items', COALESCE((SELECT json_agg(i) FROM (
          SELECT "productName", quantity FROM "SaleDocumentItem" WHERE "documentId" = r.id ORDER BY id LIMIT 200
        ) i), '[]'::json),
        'itemCount', (SELECT COUNT(*) FROM "SaleDocumentItem" WHERE "documentId" = r.id),
        'client', (SELECT json_build_object('firstName', "firstName", 'lastName', "lastName", 'phone', phone) FROM "Client" WHERE id = r."clientId")
      )) FROM page_rows r` : Prisma.sql`SELECT json_agg(page_rows) FROM page_rows`;
    // Every group is computed over the full filter; only the result page enters Node memory.
    const [result] = await prisma.$queryRaw<Array<any>>(Prisma.sql`
      WITH ${base}, grouped AS (${groups}), page_rows AS (SELECT * FROM grouped ORDER BY ${order} LIMIT ${limit} OFFSET ${skip})
      SELECT (SELECT COUNT(*)::double precision FROM grouped) AS total,
        COALESCE((${serializedRows}), '[]'::json) AS rows,
        (SELECT json_build_object('totalOrders', COUNT(*)::double precision, 'totalRevenue', COALESCE(SUM(total), 0),
          'totalCost', COALESCE(SUM("totalCost"), 0), 'totalProfit', COALESCE(SUM("totalProfit"), 0)) FROM doc_rows) AS stats,
        (SELECT json_build_object('unpaidCount', COUNT(*)::double precision, 'unpaidAmount', COALESCE(SUM(total), 0))
          FROM "SaleDocument" WHERE "paymentStatus" <> 'paid') AS unpaid,
        COALESCE((SELECT json_agg(days ORDER BY day) FROM (
          SELECT DATE_TRUNC('day', "saleDate") AS day, SUM(total) AS revenue, SUM("totalProfit") AS profit,
            SUM("totalCost") AS cost, COUNT(*)::double precision AS orders FROM doc_rows
          GROUP BY 1 ORDER BY day DESC LIMIT 120
        ) days), '[]'::json) AS chart
    `);
    result.stats.averageCheck = result.stats.totalOrders ? result.stats.totalRevenue / result.stats.totalOrders : 0;
    result.stats.margin = result.stats.totalRevenue > 0 ? result.stats.totalProfit / result.stats.totalRevenue * 100 : 0;
    Object.assign(result.stats, result.unpaid);
    res.json({ rows: result.rows, total: result.total, stats: result.stats, chart: result.chart, page, limit });
  } catch (error) {
    console.error('Report analytics error:', error);
    res.status(500).json({ error: 'Ошибка загрузки аналитики' });
  }
}

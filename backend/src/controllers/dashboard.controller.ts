import { PrismaClient, Prisma } from '@prisma/client';
import { Response } from 'express';
import { RequestWithUser } from '../types';

const prisma = new PrismaClient();
export async function dashboardData(db: Prisma.TransactionClient, start: Date, end: Date) {
  const dateFilter = Prisma.sql`d."saleDate" >= ${start} AND d."saleDate" <= ${end}`;
  const paid = Prisma.sql`lower(d."paymentStatus") IN ('paid', 'payed', 'оплачен')`;
  const [financial] = await db.$queryRaw<any[]>(Prisma.sql`
    WITH docs AS (SELECT d.*, ${paid} AS paid FROM "SaleDocument" d WHERE ${dateFilter}),
    costs AS (SELECT COALESCE(SUM(i.cost_price * i.quantity), 0) AS cost
      FROM "SaleDocumentItem" i JOIN docs d ON d.id = i."documentId" WHERE d.paid)
    SELECT COUNT(*) FILTER(WHERE paid)::float AS "totalSales",
      COALESCE(SUM(total) FILTER(WHERE paid), 0)::float AS "totalRevenue",
      (SELECT cost FROM costs)::float AS "totalCost",
      COUNT(*) FILTER(WHERE NOT paid)::float AS "unpaidSales",
      COALESCE(SUM(total) FILTER(WHERE NOT paid), 0)::float AS "unpaidTotal" FROM docs`);
  const [catalog] = await db.$queryRaw<any[]>`SELECT COUNT(*)::float AS "totalProducts",
    COALESCE(SUM(stock), 0)::float AS "totalStock",
    COUNT(*) FILTER(WHERE stock <= min_stock)::float AS "lowStockCount" FROM "Product"`;
  const totalClients = await db.client.count();
  const lowStock = await db.product.findMany({ where: { stock: { lte: db.product.fields.min_stock } },
    orderBy: [{ stock: 'asc' }, { id: 'asc' }], take: 10,
    select: { id: true, name: true, article: true, stock: true, min_stock: true } });
  const topProducts = await db.$queryRaw<any[]>(Prisma.sql`
    WITH top AS (SELECT i."productId", SUM(i.quantity)::float AS total_sold,
      SUM(COALESCE(NULLIF(i.total, 0), i.price * i.quantity))::float AS total_revenue
      FROM "SaleDocumentItem" i JOIN "SaleDocument" d ON d.id = i."documentId"
      WHERE ${dateFilter} AND ${paid} GROUP BY i."productId"
      HAVING SUM(i.quantity) > 0 ORDER BY total_sold DESC, i."productId" ASC LIMIT 5)
    SELECT p.id, latest."productName" AS name, COALESCE(NULLIF(p.article,''), latest."productArticle", '—') AS article,
      COALESCE(NULLIF(latest.price,0), p.retail_price,0) AS retail_price, top.total_sold, top.total_revenue,
      CASE WHEN p.retail_price <> 0 AND p.cost_price <> 0 THEN (p.retail_price-p.cost_price)/p.retail_price*100 ELSE 0 END AS profit_margin
    FROM top JOIN "Product" p ON p.id=top."productId"
    JOIN LATERAL (SELECT i.* FROM "SaleDocumentItem" i JOIN "SaleDocument" d ON d.id=i."documentId"
      WHERE i."productId"=p.id AND ${dateFilter} AND ${paid}
      ORDER BY d."saleDate" DESC, d.id DESC, i.id ASC LIMIT 1) latest ON TRUE
    ORDER BY top.total_sold DESC, p.id ASC`);
  const recent = await db.saleDocument.findMany({ where: { saleDate: { gte: start, lte: end },
    OR: ['paid', 'payed', 'оплачен'].map(status => ({ paymentStatus: { equals: status, mode: 'insensitive' as const } })) },
    take: 5, orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
    select: { id: true, documentNumber: true, saleDate: true, customerName: true, clientName: true,
      total: true, documentType: true, client: { select: { city: true } },
      items: { select: { cost_price: true, quantity: true } } } });
  const clients = await db.client.findMany({ where: { createdAt: { gte: start, lte: end } }, take: 5,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, firstName: true, lastName: true, middleName: true, phone: true, city: true, createdAt: true, totalSpent: true } });
  const totalProfit = financial.totalRevenue - financial.totalCost;
  return { summary: { ...financial, ...catalog, totalClients, totalProfit,
      margin: financial.totalRevenue ? totalProfit / financial.totalRevenue * 100 : 0,
      averageCheck: financial.totalSales ? financial.totalRevenue / financial.totalSales : 0 },
    lowStockProducts: lowStock, topProducts,
    recentSales: recent.map(sale => ({ id: sale.id, documentNumber: sale.documentNumber, saleDate: sale.saleDate,
      customerName: sale.customerName || sale.clientName || '-', customerCity: sale.client?.city || '-',
      total: sale.total, profit: sale.total - sale.items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0),
      documentType: sale.documentType === 'receipt' ? 'Чек' : sale.documentType === 'invoice' ? 'Счет' : 'Заказ',
      paymentStatus: 'Оплачен', isPaid: true })),
    recentClients: clients.map(client => ({ ...client, name: [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') })) };
}

export const getDashboard = async (req: RequestWithUser, res: Response): Promise<void> => {
  const start = new Date(String(req.query.startDate));
  const end = new Date(String(req.query.endDate));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || end.getTime() - start.getTime() > 32 * 86400000) {
    res.status(400).json({ message: 'Неверный период дашборда' }); return;
  }
  try {
    const result = await prisma.$transaction(tx => dashboardData(tx, start, end), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15_000,
    });
    res.json(result);
  }
  catch { res.status(500).json({ message: 'Ошибка загрузки дашборда' }); }
};

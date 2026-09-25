import { Prisma } from '@prisma/client';

/** Fulfilment may be reversed without changing payment evidence. Read it live. */
export const paidSaleWhere = (): Prisma.SaleDocumentWhereInput => ({
  paymentStatus: 'paid', orderStatus: { not: 'cancelled' },
});

/** Only code-owned aliases are accepted; values remain bound parameters. */
export const paidSaleSql = (alias?: string): Prisma.Sql => {
  if (alias && !/^[a-z][a-z0-9_]*$/i.test(alias)) throw new Error('Invalid SQL alias');
  const prefix = alias ? alias + '.' : '';
  return Prisma.sql`${Prisma.raw(prefix + '"paymentStatus"')} = ${'paid'} AND ${Prisma.raw(prefix + '"orderStatus"')} <> ${'cancelled'}`;
};

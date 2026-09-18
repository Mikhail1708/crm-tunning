import { Prisma } from '@prisma/client';

// A characteristic is stored either as plain text or a JSON string array.
// Validate the latter before casting; arbitrary legacy text must stay searchable.
// PostgreSQL text rejects NUL and unpaired UTF-16 surrogates, even in valid
// JSON syntax. Accept only representable escapes before extracting JSON text.
const unicodeEscape = '(u(000[1-9a-fA-F]|00[1-9a-fA-F][0-9a-fA-F]|0[1-9a-fA-F][0-9a-fA-F]{2}|[1-9a-cA-Ce-fE-F][0-9a-fA-F]{3}|[dD][0-7][0-9a-fA-F]{2})|u[dD][89aAbB][0-9a-fA-F]{2}\\\\u[dD][c-fC-F][0-9a-fA-F]{2})';
const jsonString = `"([^"\\\\[:cntrl:]]|\\\\(["\\\\/bfnrt]|${unicodeEscape}))*"`;
const stringArray = `^[[:space:]]*\\[[[:space:]]*(${jsonString}([[:space:]]*,[[:space:]]*${jsonString})*)?[[:space:]]*\\][[:space:]]*$`;
const characteristicText = (separator: string) => Prisma.sql`CASE
  WHEN pc.value ~ ${stringArray} THEN
    (SELECT COALESCE(string_agg(element, ${separator} ORDER BY position), '')
     FROM json_array_elements_text(pc.value::json) WITH ORDINALITY AS elements(element, position))
  ELSE pc.value END`;
const contains = (column: Prisma.Sql, value: string) => Prisma.sql`strpos(lower(${column}), lower(${value})) > 0`;

export function productListFilter(query: Record<string, any>): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  const search = typeof query.search === 'string' ? query.search : '';
  if (search) {
    const nameArticle = Prisma.sql`${contains(Prisma.sql`p.name`, search)} OR ${contains(Prisma.sql`COALESCE(p.article, '')`, search)}`;
    if (query.searchScope === 'basic') conditions.push(Prisma.sql`(${nameArticle})`);
    else if (query.searchScope === 'description') conditions.push(Prisma.sql`(${nameArticle} OR ${contains(Prisma.sql`COALESCE(p.description, '')`, search)})`);
    else conditions.push(Prisma.sql`(${nameArticle}
      OR EXISTS (SELECT 1 FROM "ProductCategory" link JOIN "Category" category ON category.id = link."categoryId"
        WHERE link."productId" = p.id AND ${contains(Prisma.sql`category.name`, search)})
      OR EXISTS (SELECT 1 FROM "ProductCharacteristic" pc WHERE pc."productId" = p.id
        AND ${contains(characteristicText(' '), search)}))`);
  }
  const categoryInput = query.categoryIds ?? query.categoryId;
  const categoryIds = (Array.isArray(categoryInput) ? categoryInput : String(categoryInput ?? '').split(','))
    .map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0);
  if (categoryIds.length) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductCategory" link
    WHERE link."productId" = p.id AND link."categoryId" IN (${Prisma.join(categoryIds)}))`);
  for (const [key, operation] of [['priceMin', 'gte'], ['priceMax', 'lte']] as const) {
    const value = query[key];
    if (value !== '' && value !== undefined && (typeof value === 'string' || typeof value === 'number') && Number.isFinite(Number(value))) {
      conditions.push(operation === 'gte' ? Prisma.sql`p.retail_price >= ${Number(value)}` : Prisma.sql`p.retail_price <= ${Number(value)}`);
    }
  }
  if (query.inStockOnly === 'true' || query.inStockOnly === true) conditions.push(Prisma.sql`p.stock > 0`);
  if (query.stockStatus === 'in') conditions.push(Prisma.sql`p.stock > 0`);
  if (query.stockStatus === 'out') conditions.push(Prisma.sql`p.stock = 0`);
  // Preserve the existing catalogue's min_stock || 5 filter semantics.
  if (query.stockStatus === 'low') conditions.push(Prisma.sql`p.stock <= COALESCE(NULLIF(p.min_stock, 0), 5)`);
  let characteristics: unknown = query.characteristics;
  if (typeof characteristics === 'string') {
    try { characteristics = JSON.parse(characteristics); } catch { characteristics = {}; }
  }
  if (characteristics && typeof characteristics === 'object' && !Array.isArray(characteristics)) {
    for (const [key, value] of Object.entries(characteristics)) {
      const fieldId = Number(key);
      if (!Number.isSafeInteger(fieldId) || fieldId <= 0 || !value) continue;
      let match: Prisma.Sql;
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        if (!value.length) { conditions.push(Prisma.sql`FALSE`); continue; }
        if (query.characteristicMode === 'joined') match = contains(characteristicText(', '), value.join(', '));
        else match = Prisma.sql`(${Prisma.join(value.map(item => Prisma.sql`pc.value = ${item} OR
          CASE WHEN pc.value ~ ${stringArray} THEN
            EXISTS (SELECT 1 FROM json_array_elements_text(pc.value::json) element WHERE element = ${item})
          ELSE FALSE END`), ' OR ')})`;
      } else if (typeof value === 'string') match = contains(characteristicText(', '), value);
      else continue;
      conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductCharacteristic" pc
        WHERE pc."productId" = p.id AND pc."fieldId" = ${fieldId} AND ${match})`);
    }
  }
  return Prisma.sql`${Prisma.join(conditions, ' AND ')}`;
}

export function productListOrder(query: Record<string, any>): Prisma.Sql {
  const fields: Record<string, Prisma.Sql> = {
    createdAt: Prisma.sql`p."createdAt"`, name: Prisma.sql`p.name`,
    retail_price: Prisma.sql`p.retail_price`, stock: Prisma.sql`p.stock`,
  };
  const field = fields[String(query.sortBy)] ?? fields.createdAt;
  const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return Prisma.sql`${field} ${direction}, p.id ${direction}`;
}

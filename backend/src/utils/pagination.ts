// Prisma pagination must never receive negative take or an overflowing offset.
const positiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export function parsePagination(
  pageInput: unknown,
  limitInput: unknown,
  defaultLimit: number,
  maxLimit: number,
): { page: number; limit: number; skip: number } {
  const limit = Math.min(positiveInteger(limitInput) ?? defaultLimit, maxLimit);
  let page = positiveInteger(pageInput) ?? 1;
  // Application policy, not a Prisma/PostgreSQL type limit: avoid excessive
  // OFFSET scans. Larger datasets need cursor pagination, not huge offsets.
  const maxOffset = 1_000_000;
  if (page - 1 > Math.floor(maxOffset / limit)) page = 1;
  return { page, limit, skip: (page - 1) * limit };
}

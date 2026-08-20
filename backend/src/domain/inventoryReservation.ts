import crypto from 'crypto';

export const RESERVATION_CURRENCY = 'RUB' as const;
export const DEFAULT_RESERVATION_TTL_MS = 30 * 60 * 1000;

export type ReservationRequestItem = {
  productId: number;
  quantity: number;
};

export const normalizeReservationItems = (value: unknown): ReservationRequestItem[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null;

  const items = value.map((item: any) => ({
    productId: item?.productId,
    quantity: item?.quantity,
  }));
  if (items.some(item =>
    !Number.isSafeInteger(item.productId) || item.productId <= 0
    || !Number.isSafeInteger(item.quantity) || item.quantity <= 0
  )) return null;

  const productIds = new Set(items.map(item => item.productId));
  if (productIds.size !== items.length) return null;

  return items.sort((left, right) => left.productId - right.productId);
};

export const buildReservationPayloadHash = (
  externalOrderId: string,
  currency: string,
  items: ReservationRequestItem[],
): string => crypto
  .createHash('sha256')
  .update(JSON.stringify({ externalOrderId, currency, items }))
  .digest('hex');

export const toMinorUnits = (value: number): bigint => {
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid money value');
  const minor = Math.round(value * 100);
  if (!Number.isSafeInteger(minor)) throw new Error('Money value is too large');
  return BigInt(minor);
};

export const parseMinorUnits = (value: unknown): bigint | null => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) return null;
  return BigInt(Number(value));
};

export const minorUnitsForJson = (value: bigint): number => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Money value cannot be represented safely');
  return number;
};

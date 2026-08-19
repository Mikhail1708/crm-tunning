export const ORDER_STATUSES = [
  'confirmed',
  'assembling',
  'shipped',
  'cancelled',
] as const;

export const PAYMENT_STATUSES = [
  'unpaid',
  'pending',
  'paid',
  'failed',
  'refunded',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

const orderTransitions: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  confirmed: new Set(['assembling', 'shipped', 'cancelled']),
  assembling: new Set(['shipped', 'cancelled']),
  shipped: new Set(),
  cancelled: new Set(),
};

const paymentTransitions: Record<PaymentStatus, ReadonlySet<PaymentStatus>> = {
  unpaid: new Set(['pending', 'paid', 'failed']),
  pending: new Set(['unpaid', 'paid', 'failed']),
  failed: new Set(['unpaid', 'pending']),
  paid: new Set(['refunded']),
  refunded: new Set(),
};

export const isOrderStatus = (status: unknown): status is OrderStatus =>
  typeof status === 'string' && ORDER_STATUSES.includes(status as OrderStatus);

export const isPaymentStatus = (status: unknown): status is PaymentStatus =>
  typeof status === 'string' && PAYMENT_STATUSES.includes(status as PaymentStatus);

export const canTransitionOrderStatus = (from: string, to: string): boolean =>
  from === to || (
    isOrderStatus(from)
    && isOrderStatus(to)
    && orderTransitions[from].has(to)
  );

export const canTransitionPaymentStatus = (from: string, to: string): boolean =>
  from === to || (
    isPaymentStatus(from)
    && isPaymentStatus(to)
    && paymentTransitions[from].has(to)
  );

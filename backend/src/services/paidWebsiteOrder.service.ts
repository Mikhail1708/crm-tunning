import { SaleStockError } from './saleStock.service';

export const paidWebsiteOrderSelect = {
  source: true,
  externalOrderId: true,
  externalPaymentId: true,
  paidAmountMinor: true,
  paymentStatus: true,
  inventoryReservation: { select: { status: true, paymentId: true, paidAmountMinor: true } },
} as const;

type PaymentFacts = {
  source: string | null;
  externalOrderId: string | null;
  externalPaymentId: string | null;
  paidAmountMinor: bigint | null;
  paymentStatus: string;
  inventoryReservation: { status: string; paymentId: string | null; paidAmountMinor: bigint | null } | null;
};

export function isPaidWebsiteOrder(document: PaymentFacts): boolean {
  const reservation = document.inventoryReservation;
  const paymentEvidence = document.externalPaymentId != null || document.paidAmountMinor != null
    || reservation?.status === 'consumed' || reservation?.paymentId != null
    || reservation?.paidAmountMinor != null;
  const website = document.source === 'website' || document.externalOrderId != null
    || reservation != null || paymentEvidence;
  return website && (paymentEvidence || ['paid', 'refunded'].includes(document.paymentStatus));
}

// Call only after locking and reading the persisted document in the write transaction.
export function assertPaidWebsiteOrderEditable(document: PaymentFacts, metadata?: Record<string, unknown>): void {
  if (isPaidWebsiteOrder(document)
    && (!metadata || Object.keys(metadata).some(key => key !== 'description'))) {
    throw new SaleStockError(409, 'PAID_ORDER_IMMUTABLE',
      'Оплаченный заказ сайта нельзя редактировать. Используйте отдельные операции статуса или отмены.');
  }
}

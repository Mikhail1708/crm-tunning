import { Prisma, PrismaClient } from '@prisma/client';
import { canTransitionOrderStatus, isOrderStatus } from '../domain/orderStateMachine';
import { decideOrderCancellation } from '../domain/orderCancellation';
import { enqueueOrderStatusProjection } from './statusOutbox.service';

export class OrderLifecycleError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
    this.name = 'OrderLifecycleError';
  }
}

type LifecycleDocument = {
  id: number;
  externalOrderId: string | null;
  documentNumber: string;
  orderStatus: string;
  statusVersion: number;
  source: string | null;
  cancellationRequestId: string | null;
  cancellationDecision: string | null;
  cancellationReasonCode: string | null;
  cancellationReason: string | null;
  cancellationRequestedAt: Date | null;
  cancellationDecidedAt: Date | null;
};

export type CancellationDecisionResult = {
  requestId: string;
  decision: 'accepted' | 'rejected';
  reasonCode: string;
  reason: string | null;
  crmOrderId: number;
  externalOrderId: string;
  orderStatus: string;
  statusVersion: number;
  requestedAt: Date;
  decidedAt: Date;
  idempotent: boolean;
};

const lifecycleSelect = {
  id: true,
  externalOrderId: true,
  documentNumber: true,
  orderStatus: true,
  statusVersion: true,
  source: true,
  cancellationRequestId: true,
  cancellationDecision: true,
  cancellationReasonCode: true,
  cancellationReason: true,
  cancellationRequestedAt: true,
  cancellationDecidedAt: true,
};

const lockAndRead = async (
  tx: Prisma.TransactionClient,
  saleDocumentId: number,
): Promise<LifecycleDocument> => {
  const lockKey = `sale-document:${saleDocumentId}`;
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 2))::text AS "lockResult"
  `;
  const document = await (tx.saleDocument as any).findUnique({
    where: { id: saleDocumentId },
    select: lifecycleSelect,
  }) as LifecycleDocument | null;
  if (!document) throw new OrderLifecycleError(404, 'ORDER_NOT_FOUND', 'Sale document not found');
  return document;
};

const projectionDocument = (document: LifecycleDocument) => ({
  id: document.id,
  externalOrderId: document.externalOrderId,
  documentNumber: document.documentNumber,
  orderStatus: document.orderStatus,
  statusVersion: document.statusVersion,
});

export const updateAuthoritativeOrderStatus = async (
  prisma: PrismaClient,
  saleDocumentId: number,
  nextStatus: unknown,
): Promise<LifecycleDocument> => {
  if (!isOrderStatus(nextStatus)) {
    throw new OrderLifecycleError(400, 'INVALID_ORDER_STATUS', 'Invalid orderStatus');
  }

  return prisma.$transaction(async tx => {
    const current = await lockAndRead(tx, saleDocumentId);
    if (!canTransitionOrderStatus(current.orderStatus, nextStatus)) {
      throw new OrderLifecycleError(
        409,
        'INVALID_ORDER_STATUS_TRANSITION',
        `Invalid order status transition: ${current.orderStatus} -> ${nextStatus}`,
      );
    }
    if (current.orderStatus === nextStatus) return current;

    const updated = await (tx.saleDocument as any).update({
      where: { id: saleDocumentId },
      data: { orderStatus: nextStatus, statusVersion: { increment: 1 } },
      select: lifecycleSelect,
    }) as LifecycleDocument;
    if (updated.source === 'website') {
      await enqueueOrderStatusProjection(tx, projectionDocument(updated));
    }
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 });
};

const storedCancellationResult = (document: LifecycleDocument): CancellationDecisionResult => ({
  requestId: document.cancellationRequestId!,
  decision: document.cancellationDecision as 'accepted' | 'rejected',
  reasonCode: document.cancellationReasonCode!,
  reason: document.cancellationReason,
  crmOrderId: document.id,
  externalOrderId: document.externalOrderId!,
  orderStatus: document.orderStatus,
  statusVersion: document.statusVersion,
  requestedAt: document.cancellationRequestedAt!,
  decidedAt: document.cancellationDecidedAt!,
  idempotent: true,
});

export const decideWebsiteCancellation = async (
  prisma: PrismaClient,
  input: {
    saleDocumentId: number;
    requestId: string;
    externalOrderId: string;
    reason: string | null;
  },
): Promise<CancellationDecisionResult> => prisma.$transaction(async tx => {
  const current = await lockAndRead(tx, input.saleDocumentId);
  if (current.source !== 'website' || current.externalOrderId !== input.externalOrderId) {
    throw new OrderLifecycleError(
      409,
      'ORDER_IDENTITY_MISMATCH',
      'CRM order does not match the website order identity',
    );
  }

  if (current.cancellationRequestId) {
    if (current.cancellationRequestId !== input.requestId) {
      throw new OrderLifecycleError(
        409,
        'CANCELLATION_REQUEST_CONFLICT',
        'A different cancellation request was already decided for this order',
      );
    }
    return storedCancellationResult(current);
  }

  const requestedAt = new Date();
  const { decision, reasonCode } = decideOrderCancellation(current.orderStatus);
  const accepted = decision === 'accepted';

  const updated = await (tx.saleDocument as any).update({
    where: { id: current.id },
    data: {
      orderStatus: accepted ? 'cancelled' : current.orderStatus,
      statusVersion: accepted && current.orderStatus !== 'cancelled' ? { increment: 1 } : undefined,
      cancellationRequestId: input.requestId,
      cancellationDecision: decision,
      cancellationReasonCode: reasonCode,
      cancellationReason: input.reason,
      cancellationRequestedAt: requestedAt,
      cancellationDecidedAt: requestedAt,
    },
    select: lifecycleSelect,
  }) as LifecycleDocument;

  if (accepted && current.orderStatus !== 'cancelled') {
    await enqueueOrderStatusProjection(tx, projectionDocument(updated));
  }

  return {
    ...storedCancellationResult(updated),
    idempotent: false,
  };
}, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 });

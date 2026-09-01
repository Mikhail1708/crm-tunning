import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { isValidExternalOrderId } from '../domain/publicOrderIdempotency';
import {
  decideWebsiteCancellation,
  OrderLifecycleError,
} from '../services/orderLifecycle.service';
import { lifecyclePrisma } from '../services/statusOutbox.service';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9:_-]{1,255}$/;

export const cancelWebsiteOrder = async (req: Request, res: Response): Promise<void> => {
  const saleDocumentId = Number(req.params.crmOrderId);
  const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : '';
  const externalOrderId = typeof req.body?.externalOrderId === 'string'
    ? req.body.externalOrderId.trim()
    : '';
  const reason = req.body?.reason == null
    ? null
    : typeof req.body.reason === 'string'
      ? req.body.reason.trim().slice(0, 1_000) || null
      : undefined;

  if (
    !Number.isSafeInteger(saleDocumentId)
    || saleDocumentId <= 0
    || !REQUEST_ID_PATTERN.test(requestId)
    || !isValidExternalOrderId(externalOrderId)
    || reason === undefined
  ) {
    res.status(400).json({
      success: false,
      code: 'INVALID_CANCELLATION_REQUEST',
      message: 'crmOrderId, requestId, externalOrderId or reason is invalid',
    });
    return;
  }

  try {
    const result = await decideWebsiteCancellation(lifecyclePrisma, {
      saleDocumentId,
      requestId,
      externalOrderId,
      reason,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof OrderLifecycleError) {
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({
        success: false,
        code: 'CANCELLATION_REQUEST_CONFLICT',
        message: 'Cancellation requestId is already bound to another order',
      });
      return;
    }
    console.error('Internal CRM cancellation failed:', error);
    res.status(500).json({
      success: false,
      code: 'CANCELLATION_PROCESSING_FAILED',
      message: 'Failed to decide cancellation request',
    });
  }
};

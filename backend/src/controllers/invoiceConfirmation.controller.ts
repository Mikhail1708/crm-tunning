import { Response } from 'express';
import { RequestWithUser } from '../types';
import { lifecyclePrisma } from '../services/statusOutbox.service';
import { confirmBankInvoicePayment } from '../services/invoiceConfirmation.service';
import { SaleStockError } from '../services/saleStock.service';

export async function confirmInvoicePayment(req: RequestWithUser, res: Response): Promise<void> {
  if (!req.user) { res.status(401).json({ code: 'UNAUTHORIZED' }); return; }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length) {
    res.status(400).json({ code: 'INVALID_CONFIRMATION_PAYLOAD' }); return;
  }
  try { res.json(await confirmBankInvoicePayment(lifecyclePrisma, Number(req.params.id), req.user)); }
  catch (error) {
    if (error instanceof SaleStockError) { res.status(error.status).json({ code: error.code, message: error.message }); return; }
    res.status(500).json({ code: 'INVOICE_CONFIRMATION_FAILED' });
  }
}

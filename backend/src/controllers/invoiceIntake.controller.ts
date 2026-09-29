import { Request, Response } from 'express';
import { lifecyclePrisma } from '../services/statusOutbox.service';
import { intakeBankInvoice, releaseBankInvoice } from '../services/invoiceIntake.service';
import { SaleStockError } from '../services/saleStock.service';

function errorResponse(error: unknown, res: Response) {
  if (error instanceof SaleStockError) { res.status(error.status).json({ code: error.code, message: error.message }); return; }
  if ((error as any)?.code === 'P2002') { res.status(409).json({ code: 'INVOICE_IDENTITY_CONFLICT' }); return; }
  res.status(500).json({ code: 'INVOICE_INTAKE_FAILED' });
}
export async function createInvoiceOrder(req: Request, res: Response) {
  try { res.json(await intakeBankInvoice(lifecyclePrisma, req.body)); } catch (error) { errorResponse(error, res); }
}
export async function releaseInvoiceOrder(req: Request, res: Response) {
  try { res.json(await releaseBankInvoice(lifecyclePrisma, req.params.externalOrderId, req.body)); } catch (error) { errorResponse(error, res); }
}

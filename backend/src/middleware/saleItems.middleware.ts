import { Request, Response, NextFunction } from 'express';
import { assertSaleItems, SaleStockError } from '../services/saleStock.service';

export function validateSaleItems(req: Request, res: Response, next: NextFunction): void {
  try {
    assertSaleItems(req.body?.items);
    next();
  } catch (error) {
    if (!(error instanceof SaleStockError)) return next(error);
    res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
}

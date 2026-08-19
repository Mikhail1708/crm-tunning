import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

const isValidApiKey = (providedKey: string, expectedKey: string): boolean => {
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(expectedKey);

  return providedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

export const requireInternalApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('Internal API is unavailable: INTERNAL_API_KEY is not configured');
    res.status(503).json({ error: 'Internal API is unavailable' });
    return;
  }

  const providedKey = req.get('X-API-Key');
  if (!providedKey || !isValidApiKey(providedKey, expectedKey)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  (req as Request & { internalService?: boolean }).internalService = true;
  next();
};

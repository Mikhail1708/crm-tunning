import { ErrorRequestHandler } from 'express';

// Final boundary for parser/CORS errors and next(error). Never serialize an
// arbitrary exception, its message, stack, metadata or command arguments.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  const candidate = error?.status ?? error?.statusCode;
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate < 500 ? candidate : 500;
  console.error('CRM HTTP request failed', { status });
  res.status(status).json({ error: status < 500 ? 'Invalid request' : 'Internal server error' });
};

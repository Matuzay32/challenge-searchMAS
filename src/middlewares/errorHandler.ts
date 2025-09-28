import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/httpError.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'Internal Server Error';
  const details = isAppError ? err.details : undefined;

  const payload: Record<string, unknown> = {
    status,
    message,
  };

  if (details) {
    payload.details = details;
  }

  if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}

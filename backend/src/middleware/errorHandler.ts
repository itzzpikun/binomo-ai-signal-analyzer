// ============================================================
// src/middleware/errorHandler.ts — Global error handler
// ============================================================
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const status = err.status ?? 'ERROR';

  if (process.env['NODE_ENV'] !== 'production') {
    console.error(`[Error] ${req.method} ${req.path}:`, err.message);
    if (err.stack) console.error(err.stack);
  }

  res.status(statusCode).json({
    status,
    message: err.message || 'An unexpected error occurred',
    ...(process.env['NODE_ENV'] !== 'production' && { stack: err.stack }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export function createError(message: string, statusCode = 500, status = 'ERROR'): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.status = status;
  err.isOperational = true;
  return err;
}

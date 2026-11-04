import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';

/**
 * Centralized error handler formatted in accordance with RFC 7807 (Problem Details for HTTP APIs),
 * preserving backward-compatible error structures.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isAppError ? err.message : 'An unexpected internal error occurred';
  const details = isAppError ? err.details ?? null : null;

  if (!isAppError) {
    console.error('[UNHANDLED_ERROR]', err);
  }

  res.setHeader('Content-Type', 'application/problem+json');
  res.status(statusCode).json({
    type: `urn:urja:error:${code.toLowerCase()}`,
    title: code.replace(/_/g, ' '),
    status: statusCode,
    detail: message,
    instance: req.originalUrl,
    code,
    error: {
      code,
      message,
      details
    }
  });
}

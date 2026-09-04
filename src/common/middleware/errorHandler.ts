/**
 * iCertiX - Global Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { sendError } from '../utils/apiResponse';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || `REQ-${Date.now().toString(36).toUpperCase()}`;

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.code, err.details, requestId);
  }

  // Handle generic error
  console.error(`[Unhandled API Error ${req.method} ${req.originalUrl}]`, err);
  return sendError(
    res,
    process.env.NODE_ENV === 'production' ? 'An unexpected internal server error occurred.' : (err.message || 'Internal Server Error'),
    500,
    'INTERNAL_SERVER_ERROR',
    null,
    requestId
  );
}

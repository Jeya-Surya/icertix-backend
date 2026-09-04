/**
 * iCertiX - Unified API Response Envelope Helpers
 */

import { Response } from 'express';
import { ApiResponse, PaginatedResult } from '../../shared/types';

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200) {
  const envelope: ApiResponse<T> = {
    success: true,
    data,
    error: null
  };
  return res.status(statusCode).json(envelope);
}

export function sendPaginated<T>(res: Response, result: PaginatedResult<T>, statusCode: number = 200) {
  const envelope: ApiResponse<PaginatedResult<T>> = {
    success: true,
    data: result,
    error: null
  };
  return res.status(statusCode).json(envelope);
}

export function sendError(
  res: Response, 
  message: string, 
  statusCode: number = 500, 
  code: string = 'INTERNAL_ERROR', 
  details?: any,
  requestId?: string
) {
  const envelope: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      requestId: requestId || `REQ-${Date.now().toString(36).toUpperCase()}`,
      details
    }
  };
  return res.status(statusCode).json(envelope);
}

/**
 * iCertiX — Enterprise Rate Limiting & DoS Protection Middleware
 * 
 * Provides granular sliding-window rate limiters with unified error envelopes.
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse';

/**
 * Standard error response handler for rate limiter violations
 */
function createRateLimitHandler(message: string, code: string) {
  return (req: Request, res: Response) => {
    const requestId = (req as any).requestId || `REQ-${Date.now().toString(36).toUpperCase()}`;
    return sendError(
      res,
      message,
      429,
      code,
      {
        retryAfterSeconds: Math.ceil(
          (req as any).rateLimit?.resetTime
            ? ((req as any).rateLimit.resetTime.getTime() - Date.now()) / 1000
            : 60
        )
      },
      requestId
    );
  };
}

/**
 * Global API rate limiter: 600 requests per minute per IP
 */
export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many requests. Please slow down and try again shortly.', 'RATE_LIMIT_EXCEEDED'),
  skip: (req: Request) => req.path.startsWith('/api/health')
});

/**
 * Auth rate limiter: 15 requests per 15 minutes per IP (protects login & token endpoints)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many login attempts. Please wait 15 minutes before trying again.', 'AUTH_RATE_LIMIT_EXCEEDED')
});

/**
 * Public verification rate limiter: 120 requests per minute per IP (prevents scraping)
 */
export const publicVerificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Public verification rate limit reached. Please wait a moment.', 'VERIFY_RATE_LIMIT_EXCEEDED')
});

/**
 * Batch issuance rate limiter: 30 requests per minute per IP/tenant
 */
export const batchIssuanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Batch certificate issuance rate limit reached. Please stagger requests.', 'BATCH_RATE_LIMIT_EXCEEDED')
});

// Backward-compatibility aliases
export const globalLimiter = globalApiLimiter;
export const verifyLimiter = publicVerificationLimiter;
export const generationLimiter = batchIssuanceLimiter;

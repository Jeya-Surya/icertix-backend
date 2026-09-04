/**
 * iCertiX - Production Rate Limiting Middleware
 * Protects endpoints from brute-force authentication attempts, DDoS, and API scraping.
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please try again in 15 minutes.'
    }
  },
  handler: (_req: Request, res: Response, _next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts from this IP. Please try again in 15 minutes.'
    }
  },
  handler: (_req: Request, res: Response, _next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

export const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'VERIFY_RATE_LIMIT_EXCEEDED',
      message: 'Verification rate limit exceeded. Please wait a minute before verifying more certificates.'
    }
  },
  handler: (_req: Request, res: Response, _next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

export const generationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'GENERATION_RATE_LIMIT_EXCEEDED',
      message: 'Certificate generation rate limit reached. Please wait a minute.'
    }
  },
  handler: (_req: Request, res: Response, _next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

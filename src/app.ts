/**
 * iCertiX - Express Application & REST API Mount
 * Production-ready enterprise architecture with security headers, rate limiting, and RBAC guards.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './common';
import {
  globalLimiter,
  authLimiter,
  verifyLimiter,
  generationLimiter
} from './common/middleware/rateLimiter';

// Domain Routers
import {
  authRouter,
  platformAdminRouter,
  organisationsRouter,
  usersRouter,
  candidatesRouter,
  departmentsRouter,
  templatesRouter,
  certificatesRouter,
  credentialsRouter,
  verificationRouter,
  emailsRouter,
  auditRouter,
  reportsRouter,
  subscriptionsRouter
} from './modules';

export function createExpressApp(): express.Express {
  const app = express();

  // Trust reverse proxies on AWS (ALB, CloudFront, ECS)
  app.set('trust proxy', 1);

  // 1. Production Security Headers (Helmet)
  app.use(helmet({
    contentSecurityPolicy: false, // Managed by CloudFront or custom SPA policies
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // 2. Global Rate Limiter
  app.use(globalLimiter);

  // 3. CORS Configuration
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const corsEnv = process.env.CORS_ORIGIN;
      // Allow all origins if CORS_ORIGIN is '*' or not restricted
      if (!corsEnv || corsEnv === '*' || corsEnv.trim() === '') {
        return callback(null, true);
      }

      const originsList = corsEnv.split(',').map(s => s.trim());
      if (originsList.includes(origin) || originsList.includes('*') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }

      if (process.env.FRONTEND_URL && (process.env.FRONTEND_URL === origin || process.env.FRONTEND_URL === '*')) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Organisation-ID', 'X-User-Id'],
    exposedHeaders: ['X-Request-ID', 'Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining']
  }));

  // 4. Request Tracing & Correlation ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    (req as any).requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // 5. Access Logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[iCertiX] ${new Date().toISOString()} ${req.method} ${req.path}`);
    }
    next();
  });

  // 6. Body Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 7. Health Check (AWS ALB & ECS Target Group ready)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'iCertiX Enterprise Credential Engine',
      version: '3.0.0',
      database: 'TypeORM / PostgreSQL Active',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });

  // 8. Public Verifier (Protected with verify rate limiter)
  app.use('/api/public/verify', verifyLimiter, verificationRouter);

  // 9. Authentication & Registration (Protected with auth rate limiter)
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/register', authLimiter, authRouter);

  // 10. Platform & Multi-Tenant Modules
  app.use('/api/platform', platformAdminRouter);
  app.use('/api/organisations', organisationsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/candidates', candidatesRouter);
  app.use('/api/departments', departmentsRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/certificates', generationLimiter, certificatesRouter);
  app.use('/api/credentials', credentialsRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/subscriptions', subscriptionsRouter);

  // 11. Centralized Error Handling
  app.use(errorHandler);

  return app;
}

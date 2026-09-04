/**
 * iCertiX - Authentication & Tenant Context Middleware
 * 
 * Extracts authenticated user session/JWT or development authorization token,
 * resolves user profile, enforces tenant isolation, and attaches context to Request.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthUser, UserRole } from '../../shared/types';
import { AppRepositories } from '../../infrastructure/database';
import { sendError } from '../utils/apiResponse';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  tenantId?: string | null; // null for SUPER_ADMIN
  userRole?: UserRole;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const devUserId = req.headers['x-user-id'] as string;
    const devOrgId = req.headers['x-organisation-id'] as string;

    let userId = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      // Resolve token (in dev: user ID or standard token)
      userId = token;
    } else if (devUserId) {
      userId = devUserId;
    }

    // Default to Stanford Dean or Super Admin if headers are completely absent in initial load
    if (!userId) {
      userId = 'USR-ORG-SU-01';
    }

    const user = await AppRepositories.users.findById(userId);
    if (!user) {
      // Check by email in case an email was passed as token
      const byEmail = await AppRepositories.users.findByEmail(userId);
      if (byEmail) {
        req.user = byEmail;
        req.userRole = byEmail.role;
        req.tenantId = byEmail.organisationId || (byEmail.role === 'SUPER_ADMIN' ? null : 'ORG_001');
        return next();
      }

      return sendError(res, 'Authentication token is invalid or session has expired.', 401, 'UNAUTHORIZED');
    }

    req.user = user;
    req.userRole = user.role;

    // Tenant context derivation
    if (user.role === 'SUPER_ADMIN') {
      // Super admin can operate platform-wide or impersonate/scope to specific org via header if provided
      req.tenantId = devOrgId || user.organisationId || null;
    } else {
      // Organization users are strictly bound to their assigned organisationId
      req.tenantId = user.organisationId || 'ORG_001';
    }

    next();
  } catch (err: any) {
    return sendError(res, err.message || 'Authentication error.', 401, 'UNAUTHORIZED');
  }
}

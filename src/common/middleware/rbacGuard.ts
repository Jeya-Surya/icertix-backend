/**
 * iCertiX - Centralized RBAC & Permission Guard Middleware
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { UserRole } from '../../shared/enums';
import { hasPermission } from '../constants/roles';
import { sendError } from '../utils/apiResponse';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.userRole) {
      return sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    if (req.userRole === 'SUPER_ADMIN') {
      return next(); // Super admin bypasses all role requirements
    }

    if (!allowedRoles.includes(req.userRole)) {
      return sendError(res, `Access denied. Role '${req.userRole}' is not authorized for this resource.`, 403, 'FORBIDDEN');
    }

    next();
  };
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.userRole) {
      return sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    if (hasPermission(req.userRole, req.user.permissions, permission)) {
      return next();
    }

    return sendError(res, `Access denied. Missing permission '${permission}'.`, 403, 'FORBIDDEN');
  };
}

export function enforceTenantAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.userRole) {
    return sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
  }

  // Super admin has global access
  if (req.userRole === 'SUPER_ADMIN') {
    return next();
  }

  // Organization users cannot access a different organisation's tenantId
  const targetOrgId = req.params.organisationId || req.query.organisationId || req.body.organisationId;
  if (targetOrgId && targetOrgId !== req.tenantId) {
    return sendError(res, 'Tenant violation: Cannot access or manipulate data belonging to another organisation.', 403, 'TENANT_FORBIDDEN');
  }

  next();
}

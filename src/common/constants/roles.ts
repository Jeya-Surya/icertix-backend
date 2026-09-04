/**
 * iCertiX - Roles & Centralized Permissions Matrix
 */

import { UserRole } from '../../shared/enums';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ORG_ADMIN: 60,
  CANDIDATE: 20
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    'platform:*',
    'organisations:*',
    'users:*',
    'candidates:*',
    'courses:*',
    'templates:*',
    'certificates:*',
    'credentials:*',
    'audit:*',
    'emails:*',
    'subscriptions:*',
    'settings:*'
  ],
  ORG_ADMIN: [
    'organisation:manage',
    'users:manage',
    'candidates:manage',
    'courses:manage',
    'templates:manage',
    'certificates:issue',
    'credentials:manage',
    'audit:read',
    'emails:read',
    'subscription:view'
  ],
  CANDIDATE: [
    'credentials:self:read'
  ]
};

export function hasPermission(userRole: UserRole, userPermissions: string[] | undefined, requiredPermission: string): boolean {
  if (userRole === 'SUPER_ADMIN') return true;

  const permissions = userPermissions && userPermissions.length > 0
    ? userPermissions
    : (ROLE_PERMISSIONS[userRole] || []);

  for (const p of permissions) {
    if (p === '*' || p === requiredPermission) return true;
    if (p.endsWith(':*')) {
      const prefix = p.slice(0, -2);
      if (requiredPermission.startsWith(prefix)) return true;
    }
  }
  return false;
}

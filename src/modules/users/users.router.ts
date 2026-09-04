/**
 * iCertiX - Users Management Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { requireRole } from '../../common/middleware/rbacGuard';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError, sendPaginated } from '../../common/utils/apiResponse';
import { assertRequired } from '../../common/validators';
import { AuthUser } from '../../shared/types';

export const usersRouter = Router();

usersRouter.use(authMiddleware);

// GET /api/users - List users (Tenant-scoped for Org Admins)
usersRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const orgId = req.userRole === 'SUPER_ADMIN'
      ? null
      : (req.tenantId || 'ORG_001');

    const result = await AppRepositories.users.findAll(orgId, { page, limit, search });
    return sendPaginated(res, result);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/users - Create new organisation user
usersRouter.post('/', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, role, title, password } = req.body;
    assertRequired(req.body, ['name', 'email', 'role']);

    const targetOrgId = req.userRole === 'SUPER_ADMIN' ? (req.body.organisationId || 'ORG_001') : req.tenantId;

    const newUser: AuthUser = {
      id: `USR-${Date.now().toString().slice(-6)}`,
      name,
      email,
      role,
      organisationId: targetOrgId,
      title: title || 'Staff Member',
      status: 'ACTIVE',
      twoFactorEnabled: false
    };

    const created = await AppRepositories.users.create(newUser, password || 'password123');

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: targetOrgId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: created.id,
      details: `Created user '${name}' with role '${role}'.`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, created, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/users/:id/activate
usersRouter.post('/:id/activate', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await AppRepositories.users.update(req.params.id, { status: 'ACTIVE' });
    if (!user) return sendError(res, 'User not found.', 404);
    return sendSuccess(res, user);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/users/:id/deactivate
usersRouter.post('/:id/deactivate', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUser = await AppRepositories.users.findById(req.params.id);
    if (!targetUser) return sendError(res, 'User not found.', 404);

    const updated = await AppRepositories.users.update(req.params.id, { status: 'INACTIVE' });
    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * iCertiX - Audit Trail Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError, sendPaginated } from '../../common/utils/apiResponse';

export const auditRouter = Router();

auditRouter.use(authMiddleware);

// GET /api/audit - List immutable audit logs
auditRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isGlobal = req.userRole === 'SUPER_ADMIN';
    const orgId = isGlobal ? null : (req.tenantId || 'ORG_001');

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const action = req.query.action as string;

    const result = await AppRepositories.auditLogs.findAll(orgId, { page, limit, search, action });
    return sendPaginated(res, result);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

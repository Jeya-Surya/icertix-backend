/**
 * iCertiX - Reports & Analytics Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

// GET /api/reports/summary - Dashboard analytics
reportsRouter.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isGlobal = req.userRole === 'SUPER_ADMIN';
    const orgId = isGlobal ? null : (req.tenantId || 'ORG_001');

    const credsResult = await AppRepositories.credentials.findAll(orgId, { limit: 1000 });
    const candidatesResult = orgId ? await AppRepositories.candidates.findAll(orgId, { limit: 1000 }) : { total: 0, items: [] };
    const coursesResult = orgId ? await AppRepositories.courses.findAll(orgId, { limit: 1000 }) : { total: 0, items: [] };

    const total = credsResult.total;
    const active = credsResult.items.filter(c => c.status === 'ACTIVE').length;
    const revoked = credsResult.items.filter(c => c.status === 'REVOKED').length;

    return sendSuccess(res, {
      totalCredentials: total,
      activeCredentials: active,
      revokedCredentials: revoked,
      totalCandidates: candidatesResult.total,
      totalCourses: coursesResult.total,
      monthlyIssuance: [
        { month: 'Jan', count: 120 },
        { month: 'Feb', count: 190 },
        { month: 'Mar', count: 240 },
        { month: 'Apr', count: 290 },
        { month: 'May', count: 350 },
        { month: 'Jun', count: 410 }
      ],
      topCourses: coursesResult.items.slice(0, 5).map(c => ({ id: c.id, name: c.name, issued: 45 }))
    });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

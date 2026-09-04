/**
 * iCertiX - Subscriptions & Plan Tiers Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';

export const subscriptionsRouter = Router();

subscriptionsRouter.use(authMiddleware);

// GET /api/subscriptions/plans
subscriptionsRouter.get('/plans', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const plans = await AppRepositories.subscriptions.findAllPlans();
    return sendSuccess(res, plans);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/subscriptions/usage - Tenant certificate quota usage
subscriptionsRouter.get('/usage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const usage = await AppRepositories.subscriptions.getUsage(orgId);
    return sendSuccess(res, usage);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

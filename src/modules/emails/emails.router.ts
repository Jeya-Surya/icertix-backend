/**
 * iCertiX - Email Logs & Dispatch Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { emailService } from '../../infrastructure/email/EmailService';
import { sendSuccess, sendError, sendPaginated } from '../../common/utils/apiResponse';

export const emailsRouter = Router();

emailsRouter.use(authMiddleware);

// GET /api/emails - List email delivery logs
emailsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const status = req.query.status as string;

    const result = await AppRepositories.emailLogs.findAll(orgId, { page, limit, search, status });
    return sendPaginated(res, result);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/emails/:id/retry - Resend / retry delivery
emailsRouter.post('/:id/retry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const retried = await emailService.retryEmail(req.params.id);
    return sendSuccess(res, retried);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

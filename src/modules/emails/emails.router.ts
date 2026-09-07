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

// POST /api/emails/resend - Resend certificate delivery email by credentialId
emailsRouter.post('/resend', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { credentialId, recipientEmail, recipientName } = req.body;
    if (!credentialId) {
      return sendError(res, 'credentialId is required.', 400);
    }
    const result = await emailService.resendByCredential(credentialId, recipientEmail, recipientName);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/emails/test - Send diagnostic test email
emailsRouter.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;
    const targetEmail = email || req.user?.email || 'admin@icertix.io';
    const result = await emailService.sendTestEmail(targetEmail, req.tenantId || 'ORG_001');
    return sendSuccess(res, {
      message: `Test email dispatched to ${targetEmail}`,
      log: result,
    });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

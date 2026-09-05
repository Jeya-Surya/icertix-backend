/**
 * iCertiX - Batch Jobs & Background Worker Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { queueService } from '../../infrastructure/queue/QueueService';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';

export const jobsRouter = Router();

jobsRouter.use(authMiddleware);

// GET /api/jobs - List recent batch jobs for the tenant
jobsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || req.user?.organisationId || 'ORG_001';
    const limit = parseInt(req.query.limit as string) || 20;

    let jobs;
    if (req.user?.role === 'SUPER_ADMIN') {
      jobs = await queueService.getAllJobs();
    } else {
      jobs = await queueService.listJobsByOrg(orgId, limit);
    }

    return sendSuccess(res, jobs);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/jobs/:id - Get live progress and status of a specific batch job
jobsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await queueService.getJob(req.params.id);
    if (!job) {
      return sendError(res, `Batch job ${req.params.id} not found.`, 404);
    }

    // Tenant isolation check
    if (req.user?.role !== 'SUPER_ADMIN') {
      const orgId = req.tenantId || req.user?.organisationId || 'ORG_001';
      if (job.organisationId !== orgId) {
        return sendError(res, 'Access forbidden to this batch job.', 403);
      }
    }

    return sendSuccess(res, job);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/jobs/:id/cancel - Cancel a running batch job
jobsRouter.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await queueService.getJob(req.params.id);
    if (!job) {
      return sendError(res, `Batch job ${req.params.id} not found.`, 404);
    }

    if (req.user?.role !== 'SUPER_ADMIN') {
      const orgId = req.tenantId || req.user?.organisationId || 'ORG_001';
      if (job.organisationId !== orgId) {
        return sendError(res, 'Access forbidden to cancel this batch job.', 403);
      }
    }

    const cancelled = await queueService.cancelJob(req.params.id);
    if (!cancelled) {
      return sendError(res, 'Job cannot be cancelled (it may have already completed or failed).', 400);
    }

    return sendSuccess(res, { id: req.params.id, status: 'CANCELLED', message: 'Job cancellation requested.' });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

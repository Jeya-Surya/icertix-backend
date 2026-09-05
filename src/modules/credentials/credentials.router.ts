/**
 * iCertiX - Digital Credential Registry Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { cacheService } from '../../infrastructure/cache/CacheService';
import { webhookService } from '../../infrastructure/webhooks/WebhookService';
import { sendSuccess, sendError, sendPaginated } from '../../common/utils/apiResponse';
import { assertRequired } from '../../common/validators';

export const credentialsRouter = Router();

credentialsRouter.use(authMiddleware);

// GET /api/credentials - Registry query with multi-field search and filters
credentialsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isGlobal = req.userRole === 'SUPER_ADMIN';
    const orgId = isGlobal ? null : (req.tenantId || 'ORG_001');

    // If candidate, restrict to candidateId
    if (req.userRole === 'CANDIDATE') {
      const candidateCreds = await AppRepositories.credentials.findByCandidate(req.user?.candidateId || 'CAN_001');
      return sendSuccess(res, { items: candidateCreds, page: 1, limit: 50, total: candidateCreds.length, totalPages: 1 });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const courseId = req.query.courseId as string;

    const result = await AppRepositories.credentials.findAll(orgId, { page, limit, search, status, courseId });
    return sendPaginated(res, result);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/credentials/:id
credentialsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cred = await AppRepositories.credentials.findById(req.params.id);
    if (!cred) return sendError(res, 'Credential not found.', 404);

    // Tenant isolation check
    if (req.userRole !== 'SUPER_ADMIN' && req.userRole !== 'CANDIDATE' && cred.organisationId !== req.tenantId) {
      return sendError(res, 'Access denied.', 403, 'FORBIDDEN');
    }

    return sendSuccess(res, cred);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/credentials/:id/revoke - Revoke a credential with reason and audit trail
credentialsRouter.post('/:id/revoke', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    assertRequired(req.body, ['reason']);

    const existing = await AppRepositories.credentials.findById(req.params.id);
    if (!existing) return sendError(res, 'Credential not found.', 404);

    if (req.userRole !== 'SUPER_ADMIN' && existing.organisationId !== req.tenantId) {
      return sendError(res, 'Access denied.', 403, 'FORBIDDEN');
    }

    const revoked = await AppRepositories.credentials.revoke(req.params.id, reason, req.user?.id || 'USR_001');

    // Invalidate cached verification and standards lookups
    cacheService.invalidateCredential(req.params.id);

    // Dispatch outbound webhook
    webhookService.dispatch(existing.organisationId, 'credential.revoked', {
      credentialId: existing.id,
      certificateNumber: existing.certificateNumber,
      candidateId: existing.candidateId,
      candidateName: existing.candidateName,
      revocationReason: reason,
      revokedAt: new Date().toISOString(),
    }).catch(() => {});

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: existing.organisationId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Administrator',
      actorRole: req.user?.role,
      action: 'CREDENTIAL_REVOKED',
      targetType: 'Credential',
      targetId: req.params.id,
      details: `Revoked credential ${req.params.id}. Reason: ${reason}`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, revoked);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

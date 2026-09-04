/**
 * iCertiX - Organisations Module (Tenant-Scoped & Platform Router)
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError, sendPaginated } from '../../common/utils/apiResponse';
import { assertRequired } from '../../common/validators';

export const organisationsRouter = Router();

organisationsRouter.use(authMiddleware);

// GET /api/organisations - List (Super admin sees all; org admin sees their own)
organisationsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    if (req.userRole === 'SUPER_ADMIN') {
      const list = await AppRepositories.organisations.findAll({ page, limit, search });
      return sendPaginated(res, list);
    }

    const myOrg = await AppRepositories.organisations.findById(req.tenantId || 'ORG_001');
    return sendSuccess(res, myOrg ? [myOrg] : []);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/organisations/me - Current organisation profile
organisationsRouter.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const org = await AppRepositories.organisations.findById(orgId);
    if (!org) return sendError(res, 'Organisation not found.', 404);
    return sendSuccess(res, org);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/organisations/:id
organisationsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = req.params.id;
    if (req.userRole !== 'SUPER_ADMIN' && targetId !== req.tenantId) {
      return sendError(res, 'Access denied to other organisation data.', 403, 'FORBIDDEN');
    }

    const org = await AppRepositories.organisations.findById(targetId);
    if (!org) return sendError(res, 'Organisation not found.', 404);
    return sendSuccess(res, org);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// PATCH /api/organisations/:id - Update profile/signatories
organisationsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = req.params.id;
    if (req.userRole !== 'SUPER_ADMIN' && req.userRole !== 'ORG_ADMIN' && targetId !== req.tenantId) {
      return sendError(res, 'Access denied to modify this organisation.', 403, 'FORBIDDEN');
    }

    const updated = await AppRepositories.organisations.update(targetId, req.body);
    if (!updated) return sendError(res, 'Organisation not found.', 404);

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: targetId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      action: 'ORGANISATION_UPDATED',
      targetType: 'Organisation',
      targetId,
      details: `Updated settings for organisation '${updated.name}'.`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/organisations/:id/plan - Upgrade / change subscription plan
organisationsRouter.post('/:id/plan', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = req.params.id;
    if (req.userRole !== 'SUPER_ADMIN' && req.userRole !== 'ORG_ADMIN' && targetId !== req.tenantId) {
      return sendError(res, 'Access denied to update plan for this organisation.', 403, 'FORBIDDEN');
    }

    const { plan } = req.body;
    if (!plan || !['Free', 'Professional', 'Enterprise'].includes(plan)) {
      return sendError(res, 'Invalid plan tier specified. Must be Free, Professional, or Enterprise.', 400);
    }

    const org = await AppRepositories.organisations.findById(targetId);
    if (!org) return sendError(res, 'Organisation not found.', 404);

    const quotaMap: Record<string, number> = {
      Free: 100,
      Professional: 1000,
      Enterprise: 50000
    };

    const newQuotaTotal = quotaMap[plan] || 100;
    const currentUsed = org.certificateQuota?.used || 0;

    const updated = await AppRepositories.organisations.update(targetId, {
      plan,
      certificateQuota: {
        used: currentUsed,
        total: newQuotaTotal
      },
      features: {
        apiAccess: plan !== 'Free',
        whiteLabel: plan === 'Enterprise',
        customDomain: plan !== 'Free',
        sso: plan === 'Enterprise',
        maxTemplates: plan === 'Free' ? 2 : plan === 'Professional' ? 10 : 50
      }
    });

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: targetId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      action: 'PLAN_UPGRADED',
      targetType: 'Organisation',
      targetId,
      details: `Subscription tier for '${org.name}' changed from ${org.plan} to ${plan} (Quota: ${newQuotaTotal}).`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

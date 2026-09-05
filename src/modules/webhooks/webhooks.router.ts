/**
 * iCertiX - Institutional Webhooks Management Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { webhookService } from '../../infrastructure/webhooks/WebhookService';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';
import { assertRequired } from '../../common/validators';

export const webhooksRouter = Router();

webhooksRouter.use(authMiddleware);

// GET /api/webhooks - List all registered webhooks for tenant
webhooksRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || req.user?.organisationId || 'ORG_001';
    const endpoints = await webhookService.listEndpoints(orgId);
    return sendSuccess(res, endpoints);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/webhooks - Register a new webhook endpoint
webhooksRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || req.user?.organisationId || 'ORG_001';
    const { url, description, events } = req.body;

    assertRequired(req.body, ['url']);

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return sendError(res, 'Webhook URL must start with http:// or https://', 400);
    }

    const endpoint = await webhookService.registerEndpoint({
      organisationId: orgId,
      url,
      description,
      events: Array.isArray(events) ? events : ['credential.issued'],
    });

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: orgId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Administrator',
      actorRole: req.user?.role,
      action: 'WEBHOOK_REGISTERED',
      targetType: 'Webhook',
      targetId: endpoint.id,
      details: `Registered outbound webhook destination '${url}'.`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString(),
    });

    return sendSuccess(res, endpoint, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/webhooks/:id/test - Send a test ping event
webhooksRouter.post('/:id/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || req.user?.organisationId || 'ORG_001';
    const endpoint = await webhookService.getEndpoint(req.params.id);

    if (!endpoint) {
      return sendError(res, 'Webhook endpoint not found.', 404);
    }

    if (req.user?.role !== 'SUPER_ADMIN' && endpoint.organisationId !== orgId) {
      return sendError(res, 'Access denied.', 403);
    }

    const logs = await webhookService.dispatch(orgId, 'webhook.test', {
      ping: 'pong',
      testId: `TEST-${Date.now()}`,
      message: 'iCertiX Outbound Webhook Test Event',
      dispatchedBy: req.user?.name || 'Admin',
    });

    return sendSuccess(res, {
      message: 'Test event dispatched successfully.',
      endpoint: endpoint.url,
      delivery: logs[0] || null,
    });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// DELETE /api/webhooks/:id - Delete a webhook endpoint
webhooksRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || req.user?.organisationId || 'ORG_001';
    const endpoint = await webhookService.getEndpoint(req.params.id);

    if (!endpoint) {
      return sendError(res, 'Webhook endpoint not found.', 404);
    }

    if (req.user?.role !== 'SUPER_ADMIN' && endpoint.organisationId !== orgId) {
      return sendError(res, 'Access denied.', 403);
    }

    await webhookService.deleteEndpoint(req.params.id);

    return sendSuccess(res, { deleted: true, id: req.params.id });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/webhooks/logs - Get recent webhook delivery logs
webhooksRouter.get('/logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || req.user?.organisationId || 'ORG_001';
    const logs = await webhookService.getDeliveryLogs(orgId);
    return sendSuccess(res, logs);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

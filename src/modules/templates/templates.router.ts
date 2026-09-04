/**
 * iCertiX - Certificate Templates & Versioning Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';
import { assertRequired } from '../../common/validators';
import { CertificateTemplate, TemplateVersion } from '../../shared/types';
import { SAMPLE_SCHEMA_STANFORD } from '../../infrastructure/database/in-memory/seedData';

export const templatesRouter = Router();

templatesRouter.use(authMiddleware);

// GET /api/templates
templatesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const list = await AppRepositories.templates.findAll(orgId);
    return sendSuccess(res, list);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/templates/:id
templatesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const template = await AppRepositories.templates.findById(orgId, req.params.id);
    if (!template) return sendError(res, 'Template not found.', 404);
    return sendSuccess(res, template);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/templates
templatesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const { name, description, theme, schema, tags } = req.body;
    assertRequired(req.body, ['name']);

    const templateId = `TPL_${Date.now().toString().slice(-4)}`;
    const versionId = `VER_${Date.now().toString().slice(-4)}_1`;

    const initialSchema = schema || SAMPLE_SCHEMA_STANFORD;

    const newTemplate: CertificateTemplate = {
      id: templateId,
      organisationId: orgId,
      name,
      description: description || 'Custom Canva-style vector certificate design.',
      theme: theme || 'classic-diploma',
      tags: tags || ['Custom Design'],
      status: 'PUBLISHED',
      activeVersionId: versionId,
      schema: initialSchema,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const initialVersion: TemplateVersion = {
      id: versionId,
      templateId,
      versionNumber: 1,
      schema: initialSchema,
      changelog: 'Initial design release created with Canva Studio.',
      publishedBy: req.user?.id,
      publishedAt: new Date().toISOString()
    };

    await AppRepositories.templates.create(newTemplate);
    await AppRepositories.templates.createVersion(initialVersion);

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: orgId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Designer',
      actorRole: req.user?.role,
      action: 'TEMPLATE_CREATED',
      targetType: 'Template',
      targetId: templateId,
      details: `Created new certificate template '${name}'.`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, newTemplate, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// PATCH /api/templates/:id (Updates working schema or metadata with upsert resilience)
templatesRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    let updated = await AppRepositories.templates.update(orgId, req.params.id, req.body);
    if (!updated) {
      // Upsert: Create template if not exists yet
      const newTemplate: CertificateTemplate = {
        id: req.params.id,
        organisationId: orgId,
        name: req.body.name || 'Custom Certificate Template',
        description: req.body.description || 'Vector certificate layout.',
        theme: req.body.theme || 'classic-diploma',
        tags: req.body.tags || ['Custom'],
        status: req.body.status || 'PUBLISHED',
        activeVersionId: `VER_${Date.now().toString().slice(-4)}_1`,
        schema: req.body.schema,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await AppRepositories.templates.create(newTemplate);
      updated = newTemplate;
    }
    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/templates/:id/versions
templatesRouter.get('/:id/versions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const versions = await AppRepositories.templates.findVersions(req.params.id);
    return sendSuccess(res, versions);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/templates/:id/versions (Publish immutable new version)
templatesRouter.post('/:id/versions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const template = await AppRepositories.templates.findById(orgId, req.params.id);
    if (!template) return sendError(res, 'Template not found.', 404);

    const existingVersions = await AppRepositories.templates.findVersions(req.params.id);
    const nextVersionNum = existingVersions.length + 1;
    const versionId = `VER_${Date.now().toString().slice(-4)}_${nextVersionNum}`;

    const schemaToPublish = req.body.schema || template.schema || SAMPLE_SCHEMA_STANFORD;

    const newVersion: TemplateVersion = {
      id: versionId,
      templateId: template.id,
      versionNumber: nextVersionNum,
      schema: schemaToPublish,
      changelog: req.body.changelog || `Published revision v${nextVersionNum}`,
      publishedBy: req.user?.id,
      publishedAt: new Date().toISOString()
    };

    await AppRepositories.templates.createVersion(newVersion);
    await AppRepositories.templates.update(orgId, template.id, {
      activeVersionId: versionId,
      schema: schemaToPublish,
      status: 'PUBLISHED',
      updatedAt: new Date().toISOString()
    });

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: orgId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Designer',
      actorRole: req.user?.role,
      action: 'TEMPLATE_VERSION_PUBLISHED',
      targetType: 'Template',
      targetId: template.id,
      details: `Published immutable version v${nextVersionNum} for template '${template.name}'.`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, newVersion, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/templates/:id/duplicate
templatesRouter.post('/:id/duplicate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const template = await AppRepositories.templates.findById(orgId, req.params.id);
    if (!template) return sendError(res, 'Template not found.', 404);

    const copyId = `TPL_${Date.now().toString().slice(-4)}`;
    const copyVerId = `VER_${Date.now().toString().slice(-4)}_1`;

    const cloned: CertificateTemplate = {
      ...template,
      id: copyId,
      name: `${template.name} (Copy)`,
      status: 'DRAFT',
      activeVersionId: copyVerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const clonedVersion: TemplateVersion = {
      id: copyVerId,
      templateId: copyId,
      versionNumber: 1,
      schema: template.schema || SAMPLE_SCHEMA_STANFORD,
      changelog: 'Cloned from ' + template.name,
      publishedAt: new Date().toISOString()
    };

    await AppRepositories.templates.create(cloned);
    await AppRepositories.templates.createVersion(clonedVersion);

    return sendSuccess(res, cloned, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// DELETE /api/templates/:id
templatesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const success = await AppRepositories.templates.delete(orgId, req.params.id);
    return sendSuccess(res, { success });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

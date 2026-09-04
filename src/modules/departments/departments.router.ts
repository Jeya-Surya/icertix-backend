/**
 * iCertiX - Departments Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';
import { assertRequired } from '../../common/validators';
import { Department } from '../../shared/types';

export const departmentsRouter = Router();

departmentsRouter.use(authMiddleware);

// GET /api/departments
departmentsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const list = await AppRepositories.departments.findAll(orgId);
    return sendSuccess(res, list);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/departments
departmentsRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const { name, code, headName } = req.body;
    assertRequired(req.body, ['name', 'code']);

    const newDept: Department = {
      id: `DEPT-${Date.now().toString().slice(-4)}`,
      organisationId: orgId,
      name,
      code: code.toUpperCase(),
      headName: headName || '',
      createdAt: new Date().toISOString()
    };

    const created = await AppRepositories.departments.create(newDept);
    return sendSuccess(res, created, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

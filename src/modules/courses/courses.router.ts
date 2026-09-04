/**
 * iCertiX - Course Management Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError, sendPaginated } from '../../common/utils/apiResponse';
import { assertRequired } from '../../common/validators';
import { Course } from '../../shared/types';

export const coursesRouter = Router();

coursesRouter.use(authMiddleware);

// GET /api/courses
coursesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const category = req.query.category as string;

    const result = await AppRepositories.courses.findAll(orgId, { page, limit, search, category });
    return sendPaginated(res, result);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/courses/:id
coursesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const course = await AppRepositories.courses.findById(orgId, req.params.id);
    if (!course) return sendError(res, 'Course not found.', 404);
    return sendSuccess(res, course);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/courses
coursesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const { name, code, duration, category, instructor, skills } = req.body;
    assertRequired(req.body, ['name', 'code']);

    const newCourse: Course = {
      id: `CRS_${Date.now().toString().slice(-4)}`,
      organisationId: orgId,
      name,
      code: code.toUpperCase(),
      duration: duration || '12 Weeks',
      category: category || 'Engineering',
      instructor: instructor || 'Faculty Instructor',
      skills: skills || [],
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await AppRepositories.courses.create(newCourse);
    return sendSuccess(res, created, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// PUT /api/courses/:id
coursesRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const updated = await AppRepositories.courses.update(orgId, req.params.id, req.body);
    if (!updated) return sendError(res, 'Course not found.', 404);
    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// PATCH /api/courses/:id
coursesRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const updated = await AppRepositories.courses.update(orgId, req.params.id, req.body);
    if (!updated) return sendError(res, 'Course not found.', 404);
    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// DELETE /api/courses/:id
coursesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const success = await AppRepositories.courses.delete(orgId, req.params.id);
    return sendSuccess(res, { success });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

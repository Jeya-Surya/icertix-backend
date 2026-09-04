/**
 * iCertiX - Candidate Management Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError, sendPaginated } from '../../common/utils/apiResponse';
import { assertRequired, assertEmail } from '../../common/validators';
import { Candidate } from '../../shared/types';

export const candidatesRouter = Router();

candidatesRouter.use(authMiddleware);

// GET /api/candidates
candidatesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const department = req.query.department as string;
    const status = req.query.status as string;

    const result = await AppRepositories.candidates.findAll(orgId, { page, limit, search, department, status });
    return sendPaginated(res, result);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/candidates/:id
candidatesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const candidate = await AppRepositories.candidates.findById(orgId, req.params.id);
    if (!candidate) return sendError(res, 'Candidate not found.', 404);
    return sendSuccess(res, candidate);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/candidates
candidatesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const { name, email, studentId, department, enrolledCourseIds } = req.body;
    assertRequired(req.body, ['name', 'email']);
    assertEmail(email);

    const generatedId = `CAN_${Date.now().toString().slice(-4)}_${Math.floor(100 + Math.random() * 900)}`;
    const newCandidate: Candidate = {
      id: generatedId,
      organisationId: orgId,
      name,
      email,
      studentId: studentId || `CAND-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      department: department || 'General Studies',
      status: 'Active',
      enrolledCourseIds: enrolledCourseIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await AppRepositories.candidates.create(newCandidate);

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: orgId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Staff',
      actorRole: req.user?.role,
      action: 'CANDIDATE_CREATED',
      targetType: 'Candidate',
      targetId: created.id,
      details: `Added new candidate '${name}' (${email}).`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, created, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/candidates/import (Bulk CSV/JSON Import)
candidatesRouter.post('/import', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const { candidates } = req.body;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return sendError(res, 'Array of candidate records is required.', 400);
    }

    const createdList: Candidate[] = [];
    for (const item of candidates) {
      if (item.name && item.email) {
        const id = `CAN_${Date.now().toString().slice(-4)}_${Math.floor(1000 + Math.random() * 9000)}`;
        const candidate: Candidate = {
          id,
          organisationId: orgId,
          name: item.name,
          email: item.email,
          studentId: item.studentId || `CAND-${Math.floor(10000 + Math.random() * 90000)}`,
          department: item.department || 'Enrolled Program',
          status: 'Active',
          enrolledCourseIds: item.enrolledCourseIds || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        createdList.push(candidate);
      }
    }

    const saved = await AppRepositories.candidates.bulkCreate(createdList);

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: orgId,
      actorId: req.user?.id,
      actor: req.user?.name || 'Staff',
      actorRole: req.user?.role,
      action: 'CANDIDATES_BULK_IMPORTED',
      targetType: 'Candidate',
      targetId: `BATCH-${saved.length}`,
      details: `Bulk imported ${saved.length} student candidate records.`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, { importedCount: saved.length, candidates: saved }, 201);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// PATCH /api/candidates/:id
candidatesRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const updated = await AppRepositories.candidates.update(orgId, req.params.id, req.body);
    if (!updated) return sendError(res, 'Candidate not found.', 404);
    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// DELETE /api/candidates/:id
candidatesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'ORG_001';
    const success = await AppRepositories.candidates.delete(orgId, req.params.id);
    return sendSuccess(res, { success });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

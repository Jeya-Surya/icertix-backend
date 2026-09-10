/**
 * iCertiX - Digital Credential Registry Router
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { cacheService } from '../../infrastructure/cache/CacheService';
import { webhookService } from '../../infrastructure/webhooks/WebhookService';
import { emailService } from '../../infrastructure/email/EmailService';
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

function mapToBackendCredential(raw: any, defaultOrgId: string = 'ORG_001'): any {
  const credId = raw.credentialId || raw.id || `ICX-2026-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
  const certNum = raw.certificateNumber || `CERT-ICX-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const candidateName = raw.candidateName || raw.recipient?.name || 'Enrolled Candidate';
  const candidateEmail = raw.candidateEmail || raw.recipient?.email || 'candidate@institution.edu';
  const candidateId = raw.candidateId || raw.recipient?.studentId || `CAN_${Date.now().toString().slice(-4)}`;
  const courseName = raw.courseName || raw.title || 'Certificate Program';
  const courseId = raw.courseId || raw.templateId || 'CRS_001';
  const templateId = raw.templateId || 'TPL_001';
  const orgId = raw.organisationId || raw.issuer?.id || defaultOrgId;
  const hashDigest = raw.hashDigest || raw.crypto?.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  return {
    id: credId,
    certificateNumber: certNum,
    organisationId: orgId,
    candidateId,
    candidateName,
    candidateEmail,
    courseId,
    courseName,
    templateId,
    templateVersionId: raw.templateVersionId || 'VER_001',
    issueDate: raw.issueDate || new Date().toISOString().split('T')[0],
    completionDate: raw.completionDate || raw.issueDate || new Date().toISOString().split('T')[0],
    expiryDate: raw.expiryDate || null,
    status: (raw.status || 'ACTIVE').toUpperCase(),
    score: raw.score != null ? String(raw.score) : '98%',
    grade: raw.grade || 'Honors & Distinction',
    skills: Array.isArray(raw.skills) ? raw.skills : ['Core Competency'],
    description: raw.description || `Conferred upon ${candidateName}.`,
    verificationUrl: raw.verificationUrl || `/verify/${credId}`,
    hashDigest,
    signatureData: raw.signatureData || (raw.crypto ? {
      algorithm: raw.crypto.signatureAlgorithm || 'Ed25519-HMAC',
      signatureHex: raw.crypto.signatureHex || 'sig_hex_placeholder',
      keyId: raw.crypto.keyId || 'KEY-PRIMARY-01',
      signedAt: raw.crypto.signedAt || new Date().toISOString(),
      canonicalPayloadJson: raw.crypto.canonicalPayloadJson || '{}'
    } : {
      algorithm: 'Ed25519-HMAC',
      signatureHex: 'sig_placeholder',
      keyId: 'KEY-PRIMARY-01',
      signedAt: new Date().toISOString(),
      canonicalPayloadJson: '{}'
    }),
    createdAt: raw.createdAt || new Date().toISOString()
  };
}

// POST /api/credentials/sync - Sync array of credentials from frontend to database
credentialsRouter.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const defaultOrgId = req.tenantId || 'ORG_001';
    const rawList = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.credentials) ? req.body.credentials : [req.body]);
    
    const saved: any[] = [];
    for (const raw of rawList) {
      if (!raw) continue;
      const cred = mapToBackendCredential(raw, defaultOrgId);
      const created = await AppRepositories.credentials.create(cred);
      saved.push(created);

      // Auto-enroll candidate if missing
      try {
        const cand = await AppRepositories.candidates.findById(cred.organisationId, cred.candidateId);
        if (!cand) {
          await AppRepositories.candidates.create({
            id: cred.candidateId,
            organisationId: cred.organisationId,
            name: cred.candidateName,
            email: cred.candidateEmail,
            studentId: (raw.recipient?.studentId) || cred.candidateId,
            department: raw.department || 'Academic Division',
            status: 'Active',
            createdAt: cred.createdAt || new Date().toISOString(),
          });
        }
      } catch {}
    }

    return sendSuccess(res, { count: saved.length, items: saved });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/credentials/batch - Batch create credentials
credentialsRouter.post('/batch', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const defaultOrgId = req.tenantId || 'ORG_001';
    const rawList = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.credentials) ? req.body.credentials : [req.body]);
    
    const saved: any[] = [];
    for (const raw of rawList) {
      if (!raw) continue;
      const cred = mapToBackendCredential(raw, defaultOrgId);
      const created = await AppRepositories.credentials.create(cred);
      saved.push(created);
    }

    return sendSuccess(res, { count: saved.length, items: saved });
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// POST /api/credentials - Create a single credential
credentialsRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const defaultOrgId = req.tenantId || 'ORG_001';
    const cred = mapToBackendCredential(req.body, defaultOrgId);
    const created = await AppRepositories.credentials.create(cred);
    return sendSuccess(res, created, 201);
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

    // Dispatch revocation email notification to recipient
    if (existing.candidateEmail) {
      const org = await AppRepositories.organisations.findById(existing.organisationId);
      emailService.sendRevocationEmail({
        organisationId: existing.organisationId,
        recipientEmail: existing.candidateEmail,
        candidateName: existing.candidateName || 'Candidate',
        courseName: existing.courseName,
        organisationName: org?.name || 'Academic Institution',
        certificateNumber: existing.certificateNumber,
        reason,
      }).catch((err: any) => console.warn(`[Credentials] Revocation email failed for ${existing.candidateEmail}:`, err.message));
    }

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

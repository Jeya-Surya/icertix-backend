import { Router, Request, Response } from 'express';
import { AppRepositories } from '../../infrastructure/database';
import { CryptoService } from '../../infrastructure/crypto/CryptoService';
import { W3cCredentialsService } from '../../infrastructure/standards/W3cCredentialsService';
import { cacheService } from '../../infrastructure/cache/CacheService';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';
import { VerificationResult, VerificationCheck } from '../../shared/types';

export const verificationRouter = Router();

// GET /api/public/verify/:credentialId - Public verification endpoint with edge caching
verificationRouter.get('/:credentialId', async (req: Request, res: Response) => {
  try {
    const credId = req.params.credentialId.trim();
    if (!credId) {
      return sendError(res, 'Credential ID is required for verification.', 400);
    }

    const cacheKey = `verify:${credId.toUpperCase()}`;
    const cached = cacheService.get<VerificationResult>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return sendSuccess(res, cached);
    }

    const cred = await AppRepositories.credentials.findById(credId);

    if (!cred) {
      const failedResult: VerificationResult = {
        verified: false,
        status: 'INVALID',
        credential: null,
        checkedAt: new Date().toISOString(),
        checks: [
          { name: 'Credential Registry Existence', passed: false, details: 'Record not found in the global authoritative ledger.' }
        ],
        diagnosticMessage: `No digital credential record exists matching identifier '${credId}'.`
      };
      return sendSuccess(res, failedResult);
    }

    const org = await AppRepositories.organisations.findById(cred.organisationId);
    const orgName = org ? org.name : 'Issuing Institution';
    const orgCode = org ? org.code : 'INST';

    // Perform Verification Checks
    const checks: VerificationCheck[] = [];

    // 1. Registry existence
    checks.push({
      name: 'Authoritative Registry Check',
      passed: true,
      details: 'Credential record positively located in the immutable ledger.'
    });

    // 2. Cryptographic signature check
    const isSigValid = CryptoService.verifySignature(cred.hashDigest, cred.signatureData);
    checks.push({
      name: 'Digital Cryptographic Proof',
      passed: isSigValid,
      details: isSigValid
        ? `Cryptographic signature verified against HSM public key ${cred.signatureData?.keyId || 'ED25519'}.`
        : 'Digital signature digest verification failed.'
    });

    // 3. Status validation
    const isActive = cred.status === 'ACTIVE';
    checks.push({
      name: 'Issuance & Revocation Status',
      passed: isActive,
      details: isActive
        ? 'Credential is valid and in active good standing.'
        : `Credential status is currently ${cred.status}${cred.revocationReason ? `: "${cred.revocationReason}"` : ''}.`
    });

    // 4. Expiry validation
    const isExpired = cred.expiryDate ? new Date(cred.expiryDate).getTime() < Date.now() : false;
    checks.push({
      name: 'Validity Term & Expiration',
      passed: !isExpired,
      details: isExpired ? `Credential expired on ${cred.expiryDate}.` : 'Credential has perpetual / active validity.'
    });

    // Diagnostic message
    let status = cred.status;
    if (isExpired) status = 'EXPIRED';
    if (!isSigValid) status = 'INVALID';

    const isVerified = status === 'ACTIVE';

    const result: VerificationResult = {
      verified: isVerified,
      status,
      credential: {
        id: cred.id,
        certificateNumber: cred.certificateNumber,
        candidateName: cred.candidateName,
        courseName: cred.courseName,
        courseCode: cred.courseId,
        organisationName: orgName,
        organisationCode: orgCode,
        department: org?.department || 'Academic Department',
        issueDate: cred.issueDate,
        completionDate: cred.completionDate,
        expiryDate: cred.expiryDate,
        score: cred.score,
        grade: cred.grade,
        skills: cred.skills,
        verificationUrl: cred.verificationUrl,
        hashDigest: cred.hashDigest,
        signatories: org?.signatories || [],
        signatureData: cred.signatureData,
        revocationReason: cred.revocationReason,
        revokedAt: cred.revokedAt
      },
      checkedAt: new Date().toISOString(),
      checks,
      diagnosticMessage: isVerified
        ? `This credential was officially issued by ${orgName} and is mathematically verified as authentic and unaltered.`
        : `Verification unsuccessful: ${checks.find(c => !c.passed)?.details || 'Status not active'}`
    };

    // Cache valid verification results for 5 minutes
    if (isVerified) {
      cacheService.set(cacheKey, result, 300);
    }
    res.setHeader('X-Cache', 'MISS');

    // Record audit verification check
    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: cred.organisationId,
      actor: 'Public Verifier',
      action: 'PUBLIC_CREDENTIAL_VERIFIED',
      targetType: 'Credential',
      targetId: cred.id,
      details: `Public verification check executed for ${cred.id}. Result: ${isVerified ? 'VERIFIED' : status}.`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/public/verify/:credentialId/vc - Export W3C Verifiable Credential JSON-LD
verificationRouter.get('/:credentialId/vc', async (req: Request, res: Response) => {
  try {
    const credId = req.params.credentialId.trim();
    const cacheKey = `vc:${credId.toUpperCase()}`;
    const cached = cacheService.get<any>(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const cred = await AppRepositories.credentials.findById(credId);
    if (!cred) {
      return sendError(res, `Credential '${credId}' not found.`, 404);
    }
    const org = await AppRepositories.organisations.findById(cred.organisationId);
    const vc = W3cCredentialsService.toW3cVerifiableCredential(cred, org);

    cacheService.set(cacheKey, vc, 300);
    res.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    return res.json(vc);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/public/verify/:credentialId/badge.json - Export 1EdTech Open Badges 3.0 Standard Payload
verificationRouter.get('/:credentialId/badge.json', async (req: Request, res: Response) => {
  try {
    const credId = req.params.credentialId.trim();
    const cacheKey = `badge:${credId.toUpperCase()}`;
    const cached = cacheService.get<any>(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const cred = await AppRepositories.credentials.findById(credId);
    if (!cred) {
      return sendError(res, `Credential '${credId}' not found.`, 404);
    }
    const org = await AppRepositories.organisations.findById(cred.organisationId);
    const badge = W3cCredentialsService.toOpenBadgeV3(cred, org);

    cacheService.set(cacheKey, badge, 300);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    return res.json(badge);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// GET /api/public/verify/:credentialId/badge-svg - Standalone Vector SVG Badge
verificationRouter.get('/:credentialId/badge-svg', async (req: Request, res: Response) => {
  try {
    const credId = req.params.credentialId.trim();
    const cacheKey = `svg:${credId.toUpperCase()}`;
    const cached = cacheService.get<string>(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached);
    }

    const cred = await AppRepositories.credentials.findById(credId);
    if (!cred) {
      return sendError(res, `Credential '${credId}' not found.`, 404);
    }
    const org = await AppRepositories.organisations.findById(cred.organisationId);
    const svg = W3cCredentialsService.toSocialBadgeSvg(cred, org);

    cacheService.set(cacheKey, svg, 3600);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Cache', 'MISS');
    return res.send(svg);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

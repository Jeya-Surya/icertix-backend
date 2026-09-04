/**
 * iCertiX - Public Verification Router (Unauthenticated)
 */

import { Router, Request, Response } from 'express';
import { AppRepositories } from '../../infrastructure/database';
import { CryptoService } from '../../infrastructure/crypto/CryptoService';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';
import { VerificationResult, VerificationCheck } from '../../shared/types';

export const verificationRouter = Router();

// GET /api/public/verify/:credentialId - Public verification endpoint
verificationRouter.get('/:credentialId', async (req: Request, res: Response) => {
  try {
    const credId = req.params.credentialId.trim();
    if (!credId) {
      return sendError(res, 'Credential ID is required for verification.', 400);
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

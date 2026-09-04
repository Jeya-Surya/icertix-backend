/**
 * iCertiX - Auth Module (Service, Controller, Router)
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../../common/middleware/authMiddleware';
import { AppRepositories } from '../../infrastructure/database';
import { sendSuccess, sendError } from '../../common/utils/apiResponse';
import { assertRequired, assertEmail } from '../../common/validators';
import { AuthUser, Organisation, CertificateTemplate, TemplateVersion, StudioDesignSchema } from '../../shared/types';

const INITIAL_TEMPLATE_SCHEMA: StudioDesignSchema = {
  version: 1,
  page: { size: 'A4', orientation: 'landscape', width: 842, height: 595 },
  background: { type: 'solid', value: '#FFFFFF' },
  elements: [
    { id: 'el-org-name', type: 'text', text: 'ACADEMIC INSTITUTION', x: 71, y: 70, width: 700, height: 35, fontSize: 18, fontWeight: 700, textAlign: 'center', color: '#0A2540' },
    { id: 'el-heading', type: 'text', text: 'CERTIFICATE OF EXCELLENCE', x: 71, y: 120, width: 700, height: 45, fontSize: 26, fontWeight: 800, textAlign: 'center', color: '#0284C7' },
    { id: 'el-presents', type: 'text', text: 'This is proudly presented to', x: 71, y: 180, width: 700, height: 25, fontSize: 14, fontStyle: 'italic', textAlign: 'center', color: '#64748B' },
    { id: 'el-recipient', type: 'dynamic-field', fieldKey: 'candidateName', fallbackText: 'Recipient Name', x: 71, y: 220, width: 700, height: 50, fontSize: 28, fontWeight: 700, textAlign: 'center', color: '#0A2540' },
    { id: 'el-reason', type: 'text', text: 'for outstanding completion of all prescribed requirements for', x: 71, y: 285, width: 700, height: 25, fontSize: 13, textAlign: 'center', color: '#64748B' },
    { id: 'el-course', type: 'dynamic-field', fieldKey: 'courseName', fallbackText: 'Course Name', x: 71, y: 320, width: 700, height: 35, fontSize: 20, fontWeight: 700, textAlign: 'center', color: '#0A2540' },
    { id: 'el-date', type: 'dynamic-field', fieldKey: 'issueDate', fallbackText: 'Issue Date: 2026-09-01', x: 100, y: 440, width: 220, height: 25, fontSize: 12, textAlign: 'left', color: '#64748B' },
    { id: 'el-sig', type: 'signature', signatoryName: 'Dean of Academic Affairs', signatoryTitle: 'Issuing Officer', x: 500, y: 430, width: 220, height: 50 },
    { id: 'el-qr', type: 'qr', x: 381, y: 420, width: 80, height: 80, qrColor: '#0A2540' }
  ]
};

export class AuthService {
  async login(emailOrIdentifier: string, passwordPlain?: string, ip: string = '127.0.0.1'): Promise<{ user: AuthUser; token: string }> {
    if (!emailOrIdentifier || !emailOrIdentifier.trim()) {
      throw new Error('Please enter your email or Candidate ID.');
    }
    if (!passwordPlain || !passwordPlain.trim()) {
      throw new Error('Please enter your password.');
    }

    let user = await AppRepositories.users.validatePassword(emailOrIdentifier.trim(), passwordPlain);

    // Auto-provision or activate candidate login if candidate is enrolled in institution records
    if (!user) {
      const trimmedId = emailOrIdentifier.trim().toLowerCase();
      const trimmedPass = (passwordPlain || '').trim();

      const orgs = await AppRepositories.organisations.findAll({ limit: 100 });
      let candidate = null;
      for (const org of orgs.items) {
        const found = (await AppRepositories.candidates.findByEmail(org.id, trimmedId)) ||
                      (await AppRepositories.candidates.findByStudentId(org.id, emailOrIdentifier.trim())) ||
                      (await AppRepositories.candidates.findById(org.id, emailOrIdentifier.trim()));
        if (found) {
          candidate = found;
          break;
        }
      }

      if (candidate) {
        const enrolledId = (candidate.studentId || '').trim().toUpperCase();
        const candDbId = (candidate.id || '').trim().toUpperCase();
        const inputPass = trimmedPass.toUpperCase();

        // If candidate entered their Candidate ID as their initial password, or candidate ID as both username & password
        if (inputPass === enrolledId || inputPass === candDbId || (trimmedId === enrolledId.toLowerCase() && inputPass === enrolledId)) {
          let existingUser = await AppRepositories.users.findByEmail(candidate.email.toLowerCase().trim());
          if (!existingUser && candidate.id) {
            existingUser = await AppRepositories.users.findById(`USR_CAND_${candidate.id}`);
          }

          if (!existingUser) {
            // Auto-provision candidate user account seamlessly
            const newUser: AuthUser = {
              id: `USR_CAND_${candidate.id}`,
              name: candidate.name || candidate.email.split('@')[0].toUpperCase(),
              email: candidate.email.toLowerCase().trim(),
              role: 'CANDIDATE',
              organisationId: candidate.organisationId,
              candidateId: candidate.id,
              title: `Candidate ID: ${candidate.studentId}`,
              status: 'ACTIVE',
              twoFactorEnabled: false,
              permissions: ['wallet:read', 'credentials:read'],
              lastLogin: new Date().toISOString(),
              createdAt: new Date().toISOString()
            };
            await AppRepositories.users.create(newUser, trimmedPass);
            user = newUser;
          } else {
            // If already claimed with a custom password, let them know
            throw new Error('This candidate account has already been claimed with a custom password. Please enter your chosen password or click Forgot Password.');
          }
        }
      }
    }

    if (!user) {
      throw new Error('Invalid email, Candidate ID, or password credentials. If this is your first time, click "First-time Candidate? Claim Account" below to activate your account.');
    }

    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      throw new Error('Account is inactive or suspended. Please contact your administrator.');
    }

    // Record login audit
    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: user.organisationId || null,
      actorId: user.id,
      actor: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      targetType: 'User',
      targetId: user.id,
      details: `User logged in successfully from IP ${ip}.`,
      ipAddress: ip,
      timestamp: new Date().toISOString()
    });

    return { user, token: user.id };
  }

  async logout(user: AuthUser, ip: string = '127.0.0.1'): Promise<void> {
    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: user.organisationId || null,
      actorId: user.id,
      actor: user.name,
      actorRole: user.role,
      action: 'USER_LOGOUT',
      targetType: 'User',
      targetId: user.id,
      details: 'User authenticated session terminated.',
      ipAddress: ip,
      timestamp: new Date().toISOString()
    });
  }

  async registerOrganisation(params: {
    orgName: string;
    orgCode?: string;
    domain?: string;
    department?: string;
    adminName: string;
    email: string;
    passwordPlain: string;
    ip?: string;
  }): Promise<{ user: AuthUser; organisation: Organisation; token: string }> {
    const { orgName, orgCode, domain, department, adminName, email, passwordPlain, ip = '127.0.0.1' } = params;
    assertRequired(params, ['orgName', 'adminName', 'email', 'passwordPlain']);
    assertEmail(email);

    const existingUser = await AppRepositories.users.findByEmail(email);
    if (existingUser) {
      throw new Error(`An account with email '${email}' already exists. Please sign in instead.`);
    }

    const firstTwoLetters = orgName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'OG';
    const code = (orgCode && orgCode.trim()) ? orgCode.trim().toUpperCase() : firstTwoLetters;
    const logo = code.slice(0, 4).toUpperCase();
    const orgId = `ORG_${Date.now().toString().slice(-4)}`;
    const userId = `USR_${code}_${Date.now().toString().slice(-4)}`;
    const templateId = `TPL_${Date.now().toString().slice(-4)}`;
    const versionId = `VER_${Date.now().toString().slice(-4)}`;

    const newOrg: Organisation = {
      id: orgId,
      name: orgName,
      code,
      domain: domain || `${code.toLowerCase()}.edu`,
      department: department || 'Academic & Executive Studies',
      logo,
      badgeColor: '#0A2540',
      plan: 'Free',
      status: 'ACTIVE',
      certificateQuota: { used: 0, total: 100 },
      features: {
        apiAccess: false,
        whiteLabel: false,
        customDomain: false,
        sso: false,
        maxTemplates: 2
      },
      signatories: [
        { id: `SIG-${code}-01`, name: adminName, role: 'Dean & Provost', keyId: `KEY-${code}-01` }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newUser: AuthUser = {
      id: userId,
      name: adminName,
      email,
      role: 'ORG_ADMIN',
      organisationId: orgId,
      title: 'Dean of Academic Affairs & Registrar',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      permissions: ['*'],
      lastLogin: new Date().toISOString()
    };

    const defaultTemplate: CertificateTemplate = {
      id: templateId,
      organisationId: orgId,
      name: 'Default Official Diploma & Certificate',
      description: 'Official verified credential layout with sovereign cryptographic seal.',
      theme: 'modern-minimal',
      tags: ['Official', 'Diploma', 'Accredited'],
      status: 'PUBLISHED',
      activeVersionId: versionId,
      schema: INITIAL_TEMPLATE_SCHEMA,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const defaultVersion: TemplateVersion = {
      id: versionId,
      templateId,
      versionNumber: 1,
      schema: INITIAL_TEMPLATE_SCHEMA,
      changelog: 'Initial version created upon organization onboarding.',
      publishedBy: userId,
      publishedAt: new Date().toISOString()
    };

    await AppRepositories.organisations.create(newOrg);
    await AppRepositories.users.create(newUser, passwordPlain);
    await AppRepositories.templates.create(defaultTemplate);
    await AppRepositories.templates.createVersion(defaultVersion);

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: orgId,
      actorId: userId,
      actor: adminName,
      actorRole: 'ORG_ADMIN',
      action: 'ORGANISATION_REGISTERED',
      targetType: 'Organisation',
      targetId: orgId,
      details: `New institution '${orgName}' (${code}) registered with administrator '${adminName}'.`,
      ipAddress: ip,
      timestamp: new Date().toISOString()
    });

    return { user: newUser, organisation: newOrg, token: userId };
  }

  async claimCandidateAccount(params: {
    email: string;
    studentId: string;
    newPassword: string;
    name?: string;
    ip?: string;
  }): Promise<{ user: AuthUser; token: string }> {
    const { email, studentId, newPassword, name, ip = '127.0.0.1' } = params;
    assertRequired(params, ['email', 'studentId', 'newPassword']);
    assertEmail(email);

    // 1. Look for an enrolled candidate record across institutions matching this email
    let candidate = null;
    const orgs = await AppRepositories.organisations.findAll({ limit: 100 });
    for (const org of orgs.items) {
      const found = await AppRepositories.candidates.findByEmail(org.id, email.toLowerCase().trim());
      if (found) {
        candidate = found;
        break;
      }
    }

    if (!candidate) {
      throw new Error(
        `No candidate record found for '${email}'. You must be enrolled and issued a Candidate ID before you can claim an account.`
      );
    }

    // 2. Validate that the candidate's Candidate ID matches the institutional record
    const inputStudentId = studentId.trim().toUpperCase();
    const enrolledStudentId = (candidate.studentId || '').trim().toUpperCase();
    if (!enrolledStudentId || enrolledStudentId !== inputStudentId) {
      throw new Error(
        `Candidate ID verification failed. The provided ID '${studentId}' does not match the record on file for this email.`
      );
    }

    // 3. Check if an active claimed account already exists for this candidate
    let existingUser = await AppRepositories.users.findByEmail(email.toLowerCase().trim());
    if (!existingUser && candidate.id) {
      existingUser = await AppRepositories.users.findById(`USR_CAND_${candidate.id}`);
    }

    if (existingUser) {
      throw new Error(
        `This candidate account has already been claimed and activated with a secure private password. You cannot change or reset your password using the claim page. Please sign in with your credentials or contact your institution administrator.`
      );
    }

    // 4. Create candidate user with the chosen private password
    const newUser: AuthUser = {
      id: `USR_CAND_${candidate.id}`,
      name: candidate.name || name || email.split('@')[0].toUpperCase(),
      email: email.toLowerCase().trim(),
      role: 'CANDIDATE',
      organisationId: candidate.organisationId,
      candidateId: candidate.id,
      title: `Candidate ID: ${enrolledStudentId}`,
      status: 'ACTIVE',
      twoFactorEnabled: false,
      permissions: ['wallet:read', 'credentials:read'],
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await AppRepositories.users.create(newUser, newPassword);

    await AppRepositories.auditLogs.create({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      organisationId: candidate.organisationId,
      actorId: newUser.id,
      actor: newUser.name,
      actorRole: 'CANDIDATE',
      action: 'CANDIDATE_ACCOUNT_CLAIMED',
      targetType: 'Candidate',
      targetId: candidate.id,
      details: `Candidate account claimed and secured with private password for Candidate ID '${enrolledStudentId}'.`,
      ipAddress: ip,
      timestamp: new Date().toISOString()
    });

    return { user: newUser, token: newUser.id };
  }
}

export const authService = new AuthService();

export const authRouter = Router();

authRouter.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    assertRequired(req.body, ['email', 'password']);
    const result = await authService.login(email, password, req.ip || '127.0.0.1');
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.message, 401, 'INVALID_CREDENTIALS');
  }
});

authRouter.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await authService.registerOrganisation({
      ...req.body,
      ip: req.ip || '127.0.0.1'
    });
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, err.message, 400, 'REGISTRATION_FAILED');
  }
});

authRouter.post('/claim-candidate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await authService.claimCandidateAccount({
      ...req.body,
      ip: req.ip || '127.0.0.1'
    });
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, err.message, 400, 'CLAIM_FAILED');
  }
});

authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  return sendSuccess(res, req.user);
});

authRouter.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    await authService.logout(req.user, req.ip || '127.0.0.1');
  }
  return sendSuccess(res, { message: 'Logged out successfully.' });
});

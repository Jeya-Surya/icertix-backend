/**
 * iCertiX - Seed Data Fixtures (Clean Initial State)
 * 
 * Empty default dataset for clean end-to-end setup and provisioning.
 * Contains only the root Platform Super Administrator and standard certificate vector schema.
 */

import { 
  Organisation, 
  AuthUser, 
  Candidate, 
  Course, 
  Department, 
  CertificateTemplate, 
  TemplateVersion, 
  Credential, 
  AuditLog, 
  EmailLog, 
  SubscriptionPlan,
  StudioDesignSchema
} from '../../../shared/types';

export const DEFAULT_CERTIFICATE_SCHEMA: StudioDesignSchema = {
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

export const SAMPLE_SCHEMA_STANFORD = DEFAULT_CERTIFICATE_SCHEMA;

export const SEED_ORGANISATIONS: Organisation[] = [];

export const SEED_USERS: AuthUser[] = [
  // Platform Super Administrator (Root bootstrap account)
  {
    id: 'USR-SUPER-01',
    name: 'System Super Administrator',
    email: 'superadmin@icertix.demo',
    role: 'SUPER_ADMIN',
    organisationId: null,
    title: 'Chief Platform Architect',
    status: 'ACTIVE',
    twoFactorEnabled: true,
    permissions: ['*'],
    lastLogin: undefined
  }
];

export const SEED_DEPARTMENTS: Department[] = [];

export const SEED_COURSES: Course[] = [];

export const SEED_CANDIDATES: Candidate[] = [];

export const SEED_TEMPLATES: CertificateTemplate[] = [];

export const SEED_TEMPLATE_VERSIONS: TemplateVersion[] = [];

export const SEED_CREDENTIALS: Credential[] = [];

export const SEED_AUDIT_LOGS: AuditLog[] = [];

export const SEED_EMAIL_LOGS: EmailLog[] = [];

export const SEED_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'PLAN-FREE',
    name: 'Free Starter',
    tier: 'Free',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    certificateQuota: 100,
    features: { apiAccess: false, whiteLabel: false, customDomain: false, sso: false, maxTemplates: 2 }
  },
  {
    id: 'PLAN-PRO',
    name: 'Professional Institution',
    tier: 'Professional',
    monthlyPriceCents: 14900,
    annualPriceCents: 149000,
    certificateQuota: 1000,
    features: { apiAccess: true, whiteLabel: false, customDomain: true, sso: false, maxTemplates: 10 }
  },
  {
    id: 'PLAN-ENT',
    name: 'Enterprise Authority',
    tier: 'Enterprise',
    monthlyPriceCents: 49900,
    annualPriceCents: 499000,
    certificateQuota: 10000,
    features: { apiAccess: true, whiteLabel: true, customDomain: true, sso: true, maxTemplates: 50 }
  }
];

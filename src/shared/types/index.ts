/**
 * iCertiX - Shared Domain Types & Contracts
 */

export * from "../enums";

import {
  UserRole,
  CredentialStatus,
  PlanTier,
  JobStatus,
  EmailDeliveryStatus,
  TemplateTheme,
  DynamicFieldKey,
} from "../enums";

// 1. API Response Envelope
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
    details?: any;
  } | null;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 2. Auth & User Model
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organisationId?: string | null; // null for SUPER_ADMIN
  candidateId?: string | null;
  title?: string;
  avatar?: string;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  permissions?: string[];
  twoFactorEnabled?: boolean;
  lastLogin?: string;
  createdAt?: string;
}

export interface TenantContext {
  organisationId: string | null; // null for SUPER_ADMIN
  userId: string;
  role: UserRole;
  permissions: string[];
}

// 3. Organisation Model
export interface OrganisationSignatory {
  id: string;
  name: string;
  role: string;
  keyId: string;
  signatureImage?: string;
}

export interface OrganisationFeatures {
  apiAccess: boolean;
  whiteLabel: boolean;
  customDomain: boolean;
  sso: boolean;
  maxTemplates: number;
}

export interface Organisation {
  id: string;
  name: string;
  code: string;
  domain: string;
  department: string;
  logo: string;
  badgeColor: string;
  plan: PlanTier;
  status?: "ACTIVE" | "SUSPENDED" | "PENDING";
  certificateQuota: {
    used: number;
    total: number;
  };
  features?: OrganisationFeatures;
  signatories: OrganisationSignatory[];
  createdAt: string;
  updatedAt: string;
}

// 4. Department & Course Models
export interface Department {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  headName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  organisationId: string;
  departmentId?: string;
  name: string;
  code: string;
  duration: string;
  category: string;
  instructor: string;
  skills?: string[];
  status?: "Active" | "Archived";
  createdAt: string;
  updatedAt?: string;
}

// 5. Candidate Model
export interface Candidate {
  id: string;
  organisationId: string;
  name: string;
  email: string;
  studentId: string;
  department: string;
  status: "Active" | "Invited" | "Completed" | "Archived";
  avatar?: string;
  enrolledCourseIds?: string[];
  createdAt: string;
  updatedAt?: string;
}

// 6. Template & Visual Design Schema (Canva-Style Visual Model)
export interface StudioElement {
  id: string;
  type:
    | "text"
    | "dynamic-field"
    | "image"
    | "seal"
    | "signature"
    | "qr"
    | "shape"
    | "line"
    | "frame";
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;

  // Typography
  text?: string;
  fieldKey?: DynamicFieldKey;
  fallbackText?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";

  // Shapes & Styling
  shapeType?: "rectangle" | "circle" | "divider" | "badge" | "corner-ornament";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;

  // Imagery & Visuals
  src?: string;
  sealType?:
    | "gold-embossed"
    | "royal-crest"
    | "academic-shield"
    | "crypto-secure"
    | "custom";
  sealSubtitle?: string;
  signatureStyle?: "cursive-1" | "cursive-2" | "calligraphy" | "uploaded";
  signatoryTitle?: string;
  signatoryName?: string;

  // QR
  qrColor?: string;
  qrBgColor?: string;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

export interface StudioDesignSchema {
  version: number;
  page: {
    size: "A4" | "US_LETTER";
    orientation: "landscape" | "portrait";
    width: number;
    height: number;
  };
  background: {
    type: "solid" | "gradient" | "pattern" | "image";
    value: string;
    gradientStop?: string;
    gradientAngle?: number;
    patternType?:
      | "none"
      | "guilloche"
      | "microprint"
      | "security-grid"
      | "parchment-texture";
  };
  elements: StudioElement[];
}

export interface CertificateTemplate {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  theme: TemplateTheme;
  tags?: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  activeVersionId: string;
  schema?: StudioDesignSchema;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  schema: StudioDesignSchema;
  changelog?: string;
  publishedBy?: string;
  publishedAt: string;
}

// 7. Authoritative Digital Credential Record
export interface CredentialSignatureMetadata {
  algorithm: string;
  signature: string;
  keyId: string;
  timestamp: string;
  publicKeyFingerprint?: string;
}

export interface Credential {
  id: string; // e.g. 'ICX-2026-7F8A91C2'
  certificateNumber: string;
  organisationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  courseId: string;
  courseName: string;
  templateId: string;
  templateVersionId: string;
  issueDate: string;
  completionDate: string;
  expiryDate?: string | null;
  status: CredentialStatus;
  score?: string;
  grade?: string;
  skills?: string[];
  description?: string;
  verificationUrl: string;
  hashDigest: string; // SHA-256 canonical digest
  signatureData: CredentialSignatureMetadata;
  revocationReason?: string;
  revokedAt?: string;
  revokedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// 8. Bulk Generation Job
export interface CertificateJob {
  id: string;
  organisationId: string;
  courseId: string;
  templateVersionId: string;
  createdBy: string;
  status: JobStatus;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  generatedCredentialIds: string[];
  errors: Array<{ candidateId: string; error: string }>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// 9. Public Verification Response
export interface VerificationCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface VerificationResult {
  verified: boolean;
  status: CredentialStatus;
  credential: {
    id: string;
    certificateNumber: string;
    candidateName: string;
    candidateEmail?: string;
    courseName: string;
    courseCode?: string;
    organisationName: string;
    organisationCode: string;
    department?: string;
    issueDate: string;
    completionDate: string;
    expiryDate?: string | null;
    score?: string;
    grade?: string;
    skills?: string[];
    verificationUrl: string;
    hashDigest: string;
    signatories: OrganisationSignatory[];
    signatureData: CredentialSignatureMetadata;
    revocationReason?: string;
    revokedAt?: string;
  } | null;
  checkedAt: string;
  checks: VerificationCheck[];
  diagnosticMessage: string;
}

// 10. Audit Log & Email Log
export interface AuditLog {
  id: string;
  organisationId?: string | null;
  actorId?: string;
  actor: string;
  actorRole?: UserRole;
  action: string;
  targetType?: string;
  targetId?: string;
  details: string;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  timestamp: string;
}

export interface EmailLog {
  id: string;
  organisationId: string;
  credentialId?: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  status: EmailDeliveryStatus;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  errorMessage?: string;
  retryCount?: number;
  createdAt: string;
}

// 11. Subscriptions & Platform Settings
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: PlanTier;
  monthlyPriceCents: number;
  annualPriceCents: number;
  certificateQuota: number;
  features: OrganisationFeatures;
}

export interface PlatformSetting {
  key: string;
  value: any;
  description: string;
  updatedBy?: string;
  updatedAt: string;
}

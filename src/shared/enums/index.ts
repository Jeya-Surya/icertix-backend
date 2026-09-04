/**
 * iCertiX - Shared Enums
 */

export type UserRole = 
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'CANDIDATE';

export type CredentialStatus = 
  | 'DRAFT'
  | 'PROCESSING'
  | 'ACTIVE'
  | 'REVOKED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'INVALID';

export type PlanTier = 'Free' | 'Professional' | 'Enterprise';

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export type EmailDeliveryStatus = 'Queued' | 'Sent' | 'Delivered' | 'Opened' | 'Bounced' | 'Failed';

export type TemplateTheme = 
  | 'modern-minimal'
  | 'classic-diploma'
  | 'tech-gold'
  | 'executive-navy'
  | 'emerald-crest';

export type DynamicFieldKey = 
  | 'candidateName'
  | 'candidateId'
  | 'candidateEmail'
  | 'courseName'
  | 'courseCode'
  | 'department'
  | 'duration'
  | 'certificateNumber'
  | 'credentialId'
  | 'issueDate'
  | 'completionDate'
  | 'expiryDate'
  | 'score'
  | 'grade'
  | 'orgName'
  | 'orgDepartment'
  | 'signatory1Name'
  | 'signatory1Role'
  | 'signatory1Key'
  | 'signatory2Name'
  | 'signatory2Role'
  | 'signatory2Key'
  | 'verificationUrl'
  | 'hashDigest';

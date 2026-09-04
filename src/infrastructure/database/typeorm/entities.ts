import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';
import { UserRole, CredentialStatus, PlanTier, TemplateTheme } from '../../../shared/types';

@Entity('organisations')
export class OrganisationEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 32, unique: true })
  code!: string;

  @Column('varchar', { length: 255, default: '' })
  domain!: string;

  @Column('varchar', { length: 255, default: 'Academic Division' })
  department!: string;

  @Column('text', { default: '' })
  logo!: string;

  @Column('varchar', { length: 32, default: '#0284C7' })
  badgeColor!: string;

  @Column('varchar', { length: 32, default: 'Free' })
  plan!: PlanTier;

  @Column('varchar', { length: 32, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'SUSPENDED' | 'PENDING';

  @Column('jsonb', { default: () => "'{\"used\": 0, \"total\": 100}'" })
  certificateQuota!: { used: number; total: number };

  @Column('jsonb', {
    default: () => "'{\"apiAccess\": false, \"whiteLabel\": false, \"customDomain\": false, \"sso\": false, \"maxTemplates\": 2}'"
  })
  features!: {
    apiAccess: boolean;
    whiteLabel: boolean;
    customDomain: boolean;
    sso: boolean;
    maxTemplates: number;
  };

  @Column('jsonb', { default: () => "'[]'" })
  signatories!: Array<{
    id: string;
    name: string;
    role: string;
    keyId: string;
  }>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('users')
export class UserEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64, nullable: true })
  @Index()
  organisationId?: string | null;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 255, unique: true })
  @Index()
  email!: string;

  @Column('varchar', { length: 255, default: '$2b$10$demoHashedPasswordSaltExample' })
  passwordHash!: string;

  @Column('varchar', { length: 32, default: 'ORG_ADMIN' })
  role!: UserRole;

  @Column('varchar', { length: 255, default: 'Officer' })
  title!: string;

  @Column('varchar', { length: 64, nullable: true })
  candidateId?: string | null;

  @Column('varchar', { length: 32, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  @Column('boolean', { default: false })
  twoFactorEnabled!: boolean;

  @Column('jsonb', { default: () => "'[]'" })
  permissions!: string[];

  @Column('timestamp with time zone', { nullable: true })
  lastLogin?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('departments')
export class DepartmentEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64 })
  @Index()
  organisationId!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 32 })
  code!: string;

  @Column('varchar', { length: 255, default: '' })
  headName!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('courses')
export class CourseEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64 })
  @Index()
  organisationId!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 32 })
  code!: string;

  @Column('varchar', { length: 64, default: '120 Hours' })
  duration!: string;

  @Column('varchar', { length: 64, default: 'Academic' })
  category!: string;

  @Column('varchar', { length: 255, default: 'Lead Instructor' })
  instructor!: string;

  @Column('jsonb', { default: () => "'[\"Core Competency\"]'" })
  skills!: string[];

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('candidates')
export class CandidateEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64 })
  @Index()
  organisationId!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 255 })
  @Index()
  email!: string;

  @Column('varchar', { length: 64 })
  studentId!: string;

  @Column('varchar', { length: 255, default: 'Academic Division' })
  department!: string;

  @Column('jsonb', { default: () => "'[]'" })
  enrolledCourseIds!: string[];

  @Column('varchar', { length: 32, default: 'Active' })
  status!: 'Active' | 'Invited' | 'Completed' | 'Archived';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('certificate_templates')
export class TemplateEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64 })
  @Index()
  organisationId!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { default: 'Vector certificate design template.' })
  description!: string;

  @Column('varchar', { length: 64, default: 'classic-diploma' })
  theme!: TemplateTheme;

  @Column('jsonb', { default: () => "'[\"General\"]'" })
  tags!: string[];

  @Column('varchar', { length: 32, default: 'PUBLISHED' })
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @Column('varchar', { length: 64, default: 'VER_001' })
  activeVersionId!: string;

  @Column('jsonb', { nullable: true })
  schema?: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('template_versions')
export class TemplateVersionEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64 })
  @Index()
  templateId!: string;

  @Column('int', { default: 1 })
  versionNumber!: number;

  @Column('jsonb')
  schema!: any;

  @Column('varchar', { length: 255, default: 'Version release' })
  changelog!: string;

  @Column('varchar', { length: 64, nullable: true })
  publishedBy?: string;

  @CreateDateColumn()
  publishedAt!: Date;
}

@Entity('credentials')
export class CredentialEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64, unique: true })
  @Index()
  certificateNumber!: string;

  @Column('varchar', { length: 64 })
  @Index()
  organisationId!: string;

  @Column('varchar', { length: 64 })
  @Index()
  candidateId!: string;

  @Column('varchar', { length: 255 })
  candidateName!: string;

  @Column('varchar', { length: 255 })
  candidateEmail!: string;

  @Column('varchar', { length: 64 })
  courseId!: string;

  @Column('varchar', { length: 255 })
  courseName!: string;

  @Column('varchar', { length: 64 })
  templateId!: string;

  @Column('varchar', { length: 64, default: 'VER_001' })
  templateVersionId!: string;

  @Column('varchar', { length: 32 })
  issueDate!: string;

  @Column('varchar', { length: 32, nullable: true })
  completionDate!: string;

  @Column('varchar', { length: 32, nullable: true })
  expiryDate?: string | null;

  @Column('varchar', { length: 32, default: 'ACTIVE' })
  status!: CredentialStatus;

  @Column('varchar', { length: 32, default: '98%' })
  score!: string;

  @Column('varchar', { length: 64, default: 'Honors & Distinction' })
  grade!: string;

  @Column('jsonb', { default: () => "'[\"Core Competency\"]'" })
  skills!: string[];

  @Column('text', { default: '' })
  description!: string;

  @Column('text')
  verificationUrl!: string;

  @Column('varchar', { length: 128 })
  hashDigest!: string;

  @Column('jsonb')
  signatureData!: any;

  @Column('varchar', { length: 64, nullable: true })
  revocationReason?: string | null;

  @Column('timestamp with time zone', { nullable: true })
  revokedAt?: Date | null;

  @Column('varchar', { length: 64, nullable: true })
  revokedBy?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64, nullable: true })
  @Index()
  organisationId?: string | null;

  @Column('varchar', { length: 64, nullable: true })
  actorId?: string;

  @Column('varchar', { length: 255 })
  actor!: string;

  @Column('varchar', { length: 32, nullable: true })
  actorRole?: string;

  @Column('varchar', { length: 64 })
  action!: string;

  @Column('varchar', { length: 64, nullable: true })
  targetType?: string;

  @Column('varchar', { length: 128, nullable: true })
  targetId?: string;

  @Column('text')
  details!: string;

  @Column('varchar', { length: 64, default: '127.0.0.1' })
  ipAddress!: string;

  @CreateDateColumn()
  timestamp!: Date;
}

@Entity('email_logs')
export class EmailLogEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64 })
  @Index()
  organisationId!: string;

  @Column('varchar', { length: 64 })
  @Index()
  credentialId!: string;

  @Column('varchar', { length: 255 })
  recipientEmail!: string;

  @Column('varchar', { length: 255 })
  recipientName!: string;

  @Column('varchar', { length: 255 })
  subject!: string;

  @Column('varchar', { length: 32, default: 'Delivered' })
  status!: 'Delivered' | 'Opened' | 'Queued' | 'Bounced' | 'Failed' | 'Sent';

  @Column('varchar', { length: 128, nullable: true })
  messageId?: string;

  @CreateDateColumn()
  sentAt!: Date;
}

@Entity('subscription_plans')
export class SubscriptionPlanEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 32 })
  tier!: PlanTier;

  @Column('int', { default: 0 })
  monthlyPriceCents!: number;

  @Column('int', { default: 0 })
  annualPriceCents!: number;

  @Column('int', { default: 100 })
  certificateQuota!: number;

  @Column('jsonb')
  features!: {
    apiAccess: boolean;
    whiteLabel: boolean;
    customDomain: boolean;
    sso: boolean;
    maxTemplates: number;
  };
}

@Entity('certificate_jobs')
export class CertificateJobEntity {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Column('varchar', { length: 64 })
  @Index()
  organisationId!: string;

  @Column('varchar', { length: 64 })
  courseId!: string;

  @Column('varchar', { length: 64 })
  templateVersionId!: string;

  @Column('varchar', { length: 64 })
  createdBy!: string;

  @Column('varchar', { length: 32, default: 'PROCESSING' })
  status!: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column('int', { default: 0 })
  totalCount!: number;

  @Column('int', { default: 0 })
  processedCount!: number;

  @Column('int', { default: 0 })
  successCount!: number;

  @Column('int', { default: 0 })
  failedCount!: number;

  @Column('jsonb', { default: () => "'[]'" })
  generatedCredentialIds!: string[];

  @Column('jsonb', { default: () => "'[]'" })
  errors!: Array<{ candidateId: string; error: string }>;

  @Column('timestamp with time zone', { nullable: true })
  startedAt?: Date | null;

  @Column('timestamp with time zone', { nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}

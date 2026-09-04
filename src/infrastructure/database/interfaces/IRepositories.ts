/**
 * iCertiX - Database Repository Interfaces
 * 
 * Defines clean data access abstractions for all domain entities.
 * Allows effortless transition from InMemoryRepositories to PostgresRepositories.
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
  CertificateJob, 
  AuditLog, 
  EmailLog, 
  SubscriptionPlan,
  PlatformSetting,
  PaginatedResult,
  PaginationParams
} from '../../../shared/types';

export interface IOrganisationRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResult<Organisation>>;
  findById(id: string): Promise<Organisation | null>;
  findByCode(code: string): Promise<Organisation | null>;
  create(org: Organisation): Promise<Organisation>;
  update(id: string, updates: Partial<Organisation>): Promise<Organisation | null>;
  delete(id: string): Promise<boolean>;
}

export interface IUserRepository {
  findAll(orgId?: string | null, params?: PaginationParams): Promise<PaginatedResult<AuthUser>>;
  findById(id: string): Promise<AuthUser | null>;
  findByEmail(email: string): Promise<AuthUser | null>;
  create(user: AuthUser, passwordHash?: string): Promise<AuthUser>;
  update(id: string, updates: Partial<AuthUser> & { passwordHash?: string }): Promise<AuthUser | null>;
  delete(id: string): Promise<boolean>;
  validatePassword(email: string, passwordPlain: string): Promise<AuthUser | null>;
}

export interface ICandidateRepository {
  findAll(orgId: string, params?: PaginationParams & { department?: string; status?: string }): Promise<PaginatedResult<Candidate>>;
  findById(orgId: string, id: string): Promise<Candidate | null>;
  findByEmail(orgId: string, email: string): Promise<Candidate | null>;
  findByStudentId(orgId: string, studentId: string): Promise<Candidate | null>;
  create(candidate: Candidate): Promise<Candidate>;
  bulkCreate(candidates: Candidate[]): Promise<Candidate[]>;
  update(orgId: string, id: string, updates: Partial<Candidate>): Promise<Candidate | null>;
  delete(orgId: string, id: string): Promise<boolean>;
}

export interface IDepartmentRepository {
  findAll(orgId: string): Promise<Department[]>;
  findById(orgId: string, id: string): Promise<Department | null>;
  create(dept: Department): Promise<Department>;
  update(orgId: string, id: string, updates: Partial<Department>): Promise<Department | null>;
  delete(orgId: string, id: string): Promise<boolean>;
}

export interface ICourseRepository {
  findAll(orgId: string, params?: PaginationParams & { category?: string }): Promise<PaginatedResult<Course>>;
  findById(orgId: string, id: string): Promise<Course | null>;
  findByCode(orgId: string, code: string): Promise<Course | null>;
  create(course: Course): Promise<Course>;
  update(orgId: string, id: string, updates: Partial<Course>): Promise<Course | null>;
  delete(orgId: string, id: string): Promise<boolean>;
}

export interface ITemplateRepository {
  findAll(orgId: string): Promise<CertificateTemplate[]>;
  findById(orgId: string, id: string): Promise<CertificateTemplate | null>;
  create(template: CertificateTemplate): Promise<CertificateTemplate>;
  update(orgId: string, id: string, updates: Partial<CertificateTemplate>): Promise<CertificateTemplate | null>;
  delete(orgId: string, id: string): Promise<boolean>;
  
  // Versions
  findVersions(templateId: string): Promise<TemplateVersion[]>;
  findVersionById(templateId: string, versionId: string): Promise<TemplateVersion | null>;
  createVersion(version: TemplateVersion): Promise<TemplateVersion>;
}

export interface ICredentialRepository {
  findAll(orgId?: string | null, params?: PaginationParams & { status?: string; courseId?: string; candidateId?: string }): Promise<PaginatedResult<Credential>>;
  findById(id: string): Promise<Credential | null>;
  findByCertificateNumber(certNum: string): Promise<Credential | null>;
  findByCandidate(candidateId: string): Promise<Credential[]>;
  create(credential: Credential): Promise<Credential>;
  bulkCreate(credentials: Credential[]): Promise<Credential[]>;
  update(id: string, updates: Partial<Credential>): Promise<Credential | null>;
  revoke(id: string, reason: string, revokedBy: string): Promise<Credential | null>;
}

export interface ICertificateJobRepository {
  findById(orgId: string, jobId: string): Promise<CertificateJob | null>;
  create(job: CertificateJob): Promise<CertificateJob>;
  update(jobId: string, updates: Partial<CertificateJob>): Promise<CertificateJob | null>;
}

export interface IAuditLogRepository {
  findAll(orgId?: string | null, params?: PaginationParams & { action?: string; actor?: string }): Promise<PaginatedResult<AuditLog>>;
  create(log: AuditLog): Promise<AuditLog>;
}

export interface IEmailLogRepository {
  findAll(orgId: string, params?: PaginationParams & { status?: string }): Promise<PaginatedResult<EmailLog>>;
  findById(orgId: string, id: string): Promise<EmailLog | null>;
  create(log: EmailLog): Promise<EmailLog>;
  update(orgId: string, id: string, updates: Partial<EmailLog>): Promise<EmailLog | null>;
}

export interface ISubscriptionRepository {
  findAllPlans(): Promise<SubscriptionPlan[]>;
  findPlanByTier(tier: string): Promise<SubscriptionPlan | null>;
  getUsage(orgId: string): Promise<{ used: number; total: number; percentage: number }>;
  updatePlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | null>;
}

export interface IPlatformSettingsRepository {
  getAll(): Promise<Record<string, any>>;
  get(key: string): Promise<any>;
  set(key: string, value: any, updatedBy?: string): Promise<void>;
}

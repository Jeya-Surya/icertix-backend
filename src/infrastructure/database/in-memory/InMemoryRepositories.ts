/**
 * iCertiX - In-Memory Repository Implementations
 *
 * Implements all IRepositories interfaces with strict multi-tenant isolation,
 * pagination, searching, and filtering.
 */

import {
  IOrganisationRepository,
  IUserRepository,
  ICandidateRepository,
  ICourseRepository,
  IDepartmentRepository,
  ITemplateRepository,
  ICredentialRepository,
  ICertificateJobRepository,
  IAuditLogRepository,
  IEmailLogRepository,
  ISubscriptionRepository,
  IPlatformSettingsRepository,
} from "../interfaces/IRepositories";

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
  PaginatedResult,
  PaginationParams,
} from "../../../shared/types";

import {
  SEED_ORGANISATIONS,
  SEED_USERS,
  SEED_DEPARTMENTS,
  SEED_COURSES,
  SEED_CANDIDATES,
  SEED_TEMPLATES,
  SEED_TEMPLATE_VERSIONS,
  SEED_CREDENTIALS,
  SEED_AUDIT_LOGS,
  SEED_EMAIL_LOGS,
  SEED_SUBSCRIPTION_PLANS,
} from "./seedData";

function paginate<T>(
  items: T[],
  params?: PaginationParams,
): PaginatedResult<T> {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.max(1, Math.min(100, params?.limit || 20));
  const total = items.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const paginatedItems = items.slice(start, start + limit);

  return {
    items: paginatedItems,
    page,
    limit,
    total,
    totalPages,
  };
}

export class InMemoryOrganisationRepository implements IOrganisationRepository {
  private orgs = new Map<string, Organisation>();

  constructor() {
    SEED_ORGANISATIONS.forEach((org) => this.orgs.set(org.id, { ...org }));
  }

  async findAll(
    params?: PaginationParams,
  ): Promise<PaginatedResult<Organisation>> {
    let list = Array.from(this.orgs.values());
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.code.toLowerCase().includes(q) ||
          o.domain.toLowerCase().includes(q),
      );
    }
    return paginate(list, params);
  }

  async findById(id: string): Promise<Organisation | null> {
    return this.orgs.get(id) || null;
  }

  async findByCode(code: string): Promise<Organisation | null> {
    return (
      Array.from(this.orgs.values()).find(
        (o) => o.code.toLowerCase() === code.toLowerCase(),
      ) || null
    );
  }

  async create(org: Organisation): Promise<Organisation> {
    this.orgs.set(org.id, { ...org });
    return org;
  }

  async update(
    id: string,
    updates: Partial<Organisation>,
  ): Promise<Organisation | null> {
    const existing = this.orgs.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.orgs.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.orgs.delete(id);
  }
}

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, AuthUser>();
  private passwords = new Map<string, string>(); // email -> password

  constructor() {
    SEED_USERS.forEach((user) => {
      this.users.set(user.id, { ...user });
      this.passwords.set(user.email.toLowerCase(), "password123");
    });
  }

  async findAll(
    orgId?: string | null,
    params?: PaginationParams,
  ): Promise<PaginatedResult<AuthUser>> {
    let list = Array.from(this.users.values());
    if (orgId !== undefined && orgId !== null) {
      list = list.filter((u) => u.organisationId === orgId);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      );
    }
    return paginate(list, params);
  }

  async findById(id: string): Promise<AuthUser | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    return (
      Array.from(this.users.values()).find(
        (u) => u.email.toLowerCase() === email.toLowerCase(),
      ) || null
    );
  }

  async create(
    user: AuthUser,
    passwordPlain: string = "password123",
  ): Promise<AuthUser> {
    this.users.set(user.id, { ...user });
    this.passwords.set(user.email.toLowerCase(), passwordPlain);
    return user;
  }

  async update(
    id: string,
    updates: Partial<AuthUser> & { passwordHash?: string },
  ): Promise<AuthUser | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    if (updates.passwordHash) {
      this.passwords.set(existing.email.toLowerCase(), updates.passwordHash);
    }
    const updated = { ...existing, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async validatePassword(
    identifier: string,
    passwordPlain: string,
  ): Promise<AuthUser | null> {
    const raw = identifier.trim().toLowerCase();
    let user = await this.findByEmail(raw);
    if (!user) {
      user = await this.findById(raw);
    }
    if (!user) {
      // Find user whose title has student ID or ID matches
      user = Array.from(this.users.values()).find(
        (u) => (u.title && u.title.toLowerCase().includes(raw)) || (u.candidateId && u.candidateId.toLowerCase() === raw)
      ) || null;
    }
    if (!user) return null;
    const stored = this.passwords.get(user.email.toLowerCase());
    if (stored && stored === passwordPlain) {
      return user;
    }
    return null;
  }
}

export class InMemoryCandidateRepository implements ICandidateRepository {
  private candidates = new Map<string, Candidate>();

  constructor() {
    SEED_CANDIDATES.forEach((c) => this.candidates.set(c.id, { ...c }));
  }

  async findAll(
    orgId: string,
    params?: PaginationParams & { department?: string; status?: string },
  ): Promise<PaginatedResult<Candidate>> {
    let list = Array.from(this.candidates.values()).filter(
      (c) => c.organisationId === orgId,
    );
    if (params?.department) {
      list = list.filter(
        (c) => c.department.toLowerCase() === params.department?.toLowerCase(),
      );
    }
    if (params?.status) {
      list = list.filter(
        (c) => c.status.toLowerCase() === params.status?.toLowerCase(),
      );
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.studentId.toLowerCase().includes(q),
      );
    }
    return paginate(list, params);
  }

  async findById(orgId: string, id: string): Promise<Candidate | null> {
    const c = this.candidates.get(id);
    if (!c || c.organisationId !== orgId) return null;
    return c;
  }

  async findByEmail(orgId: string, email: string): Promise<Candidate | null> {
    return (
      Array.from(this.candidates.values()).find(
        (c) =>
          c.organisationId === orgId &&
          c.email.toLowerCase() === email.toLowerCase(),
      ) || null
    );
  }

  async findByStudentId(
    orgId: string,
    studentId: string,
  ): Promise<Candidate | null> {
    return (
      Array.from(this.candidates.values()).find(
        (c) =>
          c.organisationId === orgId &&
          c.studentId.toLowerCase() === studentId.toLowerCase(),
      ) || null
    );
  }

  async create(candidate: Candidate): Promise<Candidate> {
    this.candidates.set(candidate.id, { ...candidate });
    return candidate;
  }

  async bulkCreate(candidates: Candidate[]): Promise<Candidate[]> {
    candidates.forEach((c) => this.candidates.set(c.id, { ...c }));
    return candidates;
  }

  async update(
    orgId: string,
    id: string,
    updates: Partial<Candidate>,
  ): Promise<Candidate | null> {
    const existing = await this.findById(orgId, id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.candidates.set(id, updated);
    return updated;
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const existing = await this.findById(orgId, id);
    if (!existing) return false;
    return this.candidates.delete(id);
  }
}

export class InMemoryDepartmentRepository implements IDepartmentRepository {
  private depts = new Map<string, Department>();

  constructor() {
    SEED_DEPARTMENTS.forEach((d) => this.depts.set(d.id, { ...d }));
  }

  async findAll(orgId: string): Promise<Department[]> {
    return Array.from(this.depts.values()).filter(
      (d) => d.organisationId === orgId,
    );
  }

  async findById(orgId: string, id: string): Promise<Department | null> {
    const d = this.depts.get(id);
    if (!d || d.organisationId !== orgId) return null;
    return d;
  }

  async create(dept: Department): Promise<Department> {
    this.depts.set(dept.id, { ...dept });
    return dept;
  }

  async update(
    orgId: string,
    id: string,
    updates: Partial<Department>,
  ): Promise<Department | null> {
    const existing = await this.findById(orgId, id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.depts.set(id, updated);
    return updated;
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const existing = await this.findById(orgId, id);
    if (!existing) return false;
    return this.depts.delete(id);
  }
}

export class InMemoryCourseRepository implements ICourseRepository {
  private courses = new Map<string, Course>();

  constructor() {
    SEED_COURSES.forEach((c) => this.courses.set(c.id, { ...c }));
  }

  async findAll(
    orgId: string,
    params?: PaginationParams & { category?: string },
  ): Promise<PaginatedResult<Course>> {
    let list = Array.from(this.courses.values()).filter(
      (c) => c.organisationId === orgId,
    );
    if (params?.category) {
      list = list.filter(
        (c) => c.category.toLowerCase() === params.category?.toLowerCase(),
      );
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.instructor.toLowerCase().includes(q),
      );
    }
    return paginate(list, params);
  }

  async findById(orgId: string, id: string): Promise<Course | null> {
    const c = this.courses.get(id);
    if (!c || c.organisationId !== orgId) return null;
    return c;
  }

  async findByCode(orgId: string, code: string): Promise<Course | null> {
    return (
      Array.from(this.courses.values()).find(
        (c) =>
          c.organisationId === orgId &&
          c.code.toLowerCase() === code.toLowerCase(),
      ) || null
    );
  }

  async create(course: Course): Promise<Course> {
    this.courses.set(course.id, { ...course });
    return course;
  }

  async update(
    orgId: string,
    id: string,
    updates: Partial<Course>,
  ): Promise<Course | null> {
    const existing = await this.findById(orgId, id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.courses.set(id, updated);
    return updated;
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const existing = await this.findById(orgId, id);
    if (!existing) return false;
    return this.courses.delete(id);
  }
}

export class InMemoryTemplateRepository implements ITemplateRepository {
  private templates = new Map<string, CertificateTemplate>();
  private versions = new Map<string, TemplateVersion>();

  constructor() {
    SEED_TEMPLATES.forEach((t) => this.templates.set(t.id, { ...t }));
    SEED_TEMPLATE_VERSIONS.forEach((v) => this.versions.set(v.id, { ...v }));
  }

  async findAll(orgId: string): Promise<CertificateTemplate[]> {
    return Array.from(this.templates.values()).filter(
      (t) => t.organisationId === orgId,
    );
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<CertificateTemplate | null> {
    const t = this.templates.get(id);
    if (!t || t.organisationId !== orgId) return null;
    return t;
  }

  async create(template: CertificateTemplate): Promise<CertificateTemplate> {
    this.templates.set(template.id, { ...template });
    return template;
  }

  async update(
    orgId: string,
    id: string,
    updates: Partial<CertificateTemplate>,
  ): Promise<CertificateTemplate | null> {
    const existing = await this.findById(orgId, id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.templates.set(id, updated);
    return updated;
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const existing = await this.findById(orgId, id);
    if (!existing) return false;
    return this.templates.delete(id);
  }

  async findVersions(templateId: string): Promise<TemplateVersion[]> {
    return Array.from(this.versions.values()).filter(
      (v) => v.templateId === templateId,
    );
  }

  async findVersionById(
    templateId: string,
    versionId: string,
  ): Promise<TemplateVersion | null> {
    const v = this.versions.get(versionId);
    if (!v || v.templateId !== templateId) return null;
    return v;
  }

  async createVersion(version: TemplateVersion): Promise<TemplateVersion> {
    this.versions.set(version.id, { ...version });
    return version;
  }
}

export class InMemoryCredentialRepository implements ICredentialRepository {
  private credentials = new Map<string, Credential>();

  constructor() {
    SEED_CREDENTIALS.forEach((c) => this.credentials.set(c.id, { ...c }));
  }

  async findAll(
    orgId?: string | null,
    params?: PaginationParams & {
      status?: string;
      courseId?: string;
      candidateId?: string;
    },
  ): Promise<PaginatedResult<Credential>> {
    let list = Array.from(this.credentials.values());
    if (orgId !== undefined && orgId !== null) {
      list = list.filter((c) => c.organisationId === orgId);
    }
    if (params?.status) {
      list = list.filter((c) => c.status === params.status);
    }
    if (params?.courseId) {
      list = list.filter((c) => c.courseId === params.courseId);
    }
    if (params?.candidateId) {
      list = list.filter((c) => c.candidateId === params.candidateId);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.candidateName.toLowerCase().includes(q) ||
          c.courseName.toLowerCase().includes(q) ||
          c.certificateNumber.toLowerCase().includes(q),
      );
    }
    return paginate(list, params);
  }

  async findById(id: string): Promise<Credential | null> {
    return this.credentials.get(id) || null;
  }

  async findByCertificateNumber(certNum: string): Promise<Credential | null> {
    return (
      Array.from(this.credentials.values()).find(
        (c) => c.certificateNumber.toLowerCase() === certNum.toLowerCase(),
      ) || null
    );
  }

  async findByCandidate(candidateId: string): Promise<Credential[]> {
    return Array.from(this.credentials.values()).filter(
      (c) => c.candidateId === candidateId,
    );
  }

  async create(credential: Credential): Promise<Credential> {
    this.credentials.set(credential.id, { ...credential });
    return credential;
  }

  async bulkCreate(credentials: Credential[]): Promise<Credential[]> {
    credentials.forEach((c) => this.credentials.set(c.id, { ...c }));
    return credentials;
  }

  async update(
    id: string,
    updates: Partial<Credential>,
  ): Promise<Credential | null> {
    const existing = this.credentials.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.credentials.set(id, updated);
    return updated;
  }

  async revoke(
    id: string,
    reason: string,
    revokedBy: string,
  ): Promise<Credential | null> {
    const existing = this.credentials.get(id);
    if (!existing) return null;
    const updated: Credential = {
      ...existing,
      status: "REVOKED",
      revocationReason: reason,
      revokedAt: new Date().toISOString(),
      revokedBy,
      updatedAt: new Date().toISOString(),
    };
    this.credentials.set(id, updated);
    return updated;
  }
}

export class InMemoryCertificateJobRepository implements ICertificateJobRepository {
  private jobs = new Map<string, CertificateJob>();

  async findById(orgId: string, jobId: string): Promise<CertificateJob | null> {
    const job = this.jobs.get(jobId);
    if (!job || (orgId && job.organisationId !== orgId)) return null;
    return job;
  }

  async create(job: CertificateJob): Promise<CertificateJob> {
    this.jobs.set(job.id, { ...job });
    return job;
  }

  async update(
    jobId: string,
    updates: Partial<CertificateJob>,
  ): Promise<CertificateJob | null> {
    const existing = this.jobs.get(jobId);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.jobs.set(jobId, updated);
    return updated;
  }
}

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLog[] = [];

  constructor() {
    this.logs = [...SEED_AUDIT_LOGS];
  }

  async findAll(
    orgId?: string | null,
    params?: PaginationParams & { action?: string; actor?: string },
  ): Promise<PaginatedResult<AuditLog>> {
    let list = [...this.logs];
    if (orgId !== undefined && orgId !== null) {
      list = list.filter((l) => l.organisationId === orgId);
    }
    if (params?.action) {
      list = list.filter(
        (l) => l.action.toLowerCase() === params.action?.toLowerCase(),
      );
    }
    if (params?.actor) {
      list = list.filter((l) =>
        l.actor.toLowerCase().includes(params.actor!.toLowerCase()),
      );
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.actor.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q),
      );
    }
    list.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return paginate(list, params);
  }

  async create(log: AuditLog): Promise<AuditLog> {
    this.logs.unshift(log);
    return log;
  }
}

export class InMemoryEmailLogRepository implements IEmailLogRepository {
  private logs = new Map<string, EmailLog>();

  constructor() {
    SEED_EMAIL_LOGS.forEach((l) => this.logs.set(l.id, { ...l }));
  }

  async findAll(
    orgId: string,
    params?: PaginationParams & { status?: string },
  ): Promise<PaginatedResult<EmailLog>> {
    let list = Array.from(this.logs.values()).filter(
      (l) => l.organisationId === orgId,
    );
    if (params?.status) {
      list = list.filter((l) => l.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.recipientEmail.toLowerCase().includes(q) ||
          l.recipientName.toLowerCase().includes(q) ||
          l.subject.toLowerCase().includes(q),
      );
    }
    list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return paginate(list, params);
  }

  async findById(orgId: string, id: string): Promise<EmailLog | null> {
    const l = this.logs.get(id);
    if (!l || l.organisationId !== orgId) return null;
    return l;
  }

  async create(log: EmailLog): Promise<EmailLog> {
    this.logs.set(log.id, { ...log });
    return log;
  }

  async update(
    orgId: string,
    id: string,
    updates: Partial<EmailLog>,
  ): Promise<EmailLog | null> {
    const existing = await this.findById(orgId, id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.logs.set(id, updated);
    return updated;
  }
}

export class InMemorySubscriptionRepository implements ISubscriptionRepository {
  private plans = new Map<string, SubscriptionPlan>();

  constructor() {
    SEED_SUBSCRIPTION_PLANS.forEach((p) => this.plans.set(p.id, { ...p }));
  }

  async findAllPlans(): Promise<SubscriptionPlan[]> {
    return Array.from(this.plans.values());
  }

  async findPlanByTier(tier: string): Promise<SubscriptionPlan | null> {
    return (
      Array.from(this.plans.values()).find(
        (p) => p.tier.toLowerCase() === tier.toLowerCase(),
      ) || null
    );
  }

  async getUsage(
    orgId: string,
  ): Promise<{ used: number; total: number; percentage: number }> {
    const org =
      SEED_ORGANISATIONS.find((o) => o.id === orgId) || SEED_ORGANISATIONS[0];
    const used = org.certificateQuota.used;
    const total = org.certificateQuota.total;
    return {
      used,
      total,
      percentage: total > 0 ? Math.round((used / total) * 100) : 0,
    };
  }

  async updatePlan(
    id: string,
    updates: Partial<SubscriptionPlan>,
  ): Promise<SubscriptionPlan | null> {
    const existing = this.plans.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      features: { ...existing.features, ...(updates.features || {}) },
    };
    this.plans.set(id, updated);
    return updated;
  }
}

export class InMemoryPlatformSettingsRepository implements IPlatformSettingsRepository {
  private settings = new Map<string, any>([
    ["hsm_key_id", "HSM-ICX-ED25519-PROD01"],
    ["verification_base_url", "https://icertix.com/verify/"],
    ["enforce_2fa_for_admins", true],
    ["allowed_file_types", ["image/png", "image/jpeg", "image/svg+xml"]],
    ["max_bulk_batch_size", 500],
    ["maintenance_mode", false],
  ]);

  async getAll(): Promise<Record<string, any>> {
    const out: Record<string, any> = {};
    this.settings.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }

  async get(key: string): Promise<any> {
    return this.settings.get(key);
  }

  async set(key: string, value: any, _updatedBy?: string): Promise<void> {
    this.settings.set(key, value);
  }
}

// Global Repository Registry Singleton
export class AppRepositories {
  public static organisations: IOrganisationRepository =
    new InMemoryOrganisationRepository();
  public static users: IUserRepository = new InMemoryUserRepository();
  public static candidates: ICandidateRepository =
    new InMemoryCandidateRepository();
  public static departments: IDepartmentRepository =
    new InMemoryDepartmentRepository();
  public static courses: ICourseRepository = new InMemoryCourseRepository();
  public static templates: ITemplateRepository =
    new InMemoryTemplateRepository();
  public static credentials: ICredentialRepository =
    new InMemoryCredentialRepository();
  public static certificateJobs: ICertificateJobRepository =
    new InMemoryCertificateJobRepository();
  public static auditLogs: IAuditLogRepository =
    new InMemoryAuditLogRepository();
  public static emailLogs: IEmailLogRepository =
    new InMemoryEmailLogRepository();
  public static subscriptions: ISubscriptionRepository =
    new InMemorySubscriptionRepository();
  public static platformSettings: IPlatformSettingsRepository =
    new InMemoryPlatformSettingsRepository();
}

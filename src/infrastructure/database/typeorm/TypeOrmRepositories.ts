import {
  IOrganisationRepository,
  IUserRepository,
  ICandidateRepository,
  IDepartmentRepository,
  ICourseRepository,
  ITemplateRepository,
  ICredentialRepository,
  ICertificateJobRepository,
  IAuditLogRepository,
  IEmailLogRepository,
  ISubscriptionRepository,
  IPlatformSettingsRepository
} from '../interfaces/IRepositories';
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
  PaginationParams
} from '../../../shared/types';
import { AppDataSource } from './dataSource';
import {
  OrganisationEntity,
  UserEntity,
  DepartmentEntity,
  CourseEntity,
  CandidateEntity,
  TemplateEntity,
  TemplateVersionEntity,
  CredentialEntity,
  AuditLogEntity,
  EmailLogEntity,
  SubscriptionPlanEntity,
  CertificateJobEntity
} from './entities';
import { SEED_SUBSCRIPTION_PLANS, SEED_USERS } from '../in-memory/seedData';

export class TypeOrmOrganisationRepository implements IOrganisationRepository {
  private get repo() { return AppDataSource.getRepository(OrganisationEntity); }

  async findAll(params?: PaginationParams): Promise<PaginatedResult<Organisation>> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(100, params?.limit || 20));
    const [items, total] = await this.repo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' }
    });
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: items.map(this.toDomain),
      total,
      page,
      limit,
      totalPages
    };
  }

  async findById(id: string): Promise<Organisation | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCode(code: string): Promise<Organisation | null> {
    const entity = await this.repo.findOneBy({ code });
    return entity ? this.toDomain(entity) : null;
  }

  async create(org: Organisation): Promise<Organisation> {
    const entity = this.repo.create({
      id: org.id,
      name: org.name,
      code: org.code,
      domain: org.domain || '',
      department: org.department || 'Academic Division',
      logo: org.logo || '',
      badgeColor: org.badgeColor || '#0284C7',
      plan: org.plan || 'Free',
      status: org.status || 'ACTIVE',
      certificateQuota: org.certificateQuota || { used: 0, total: 100 },
      features: org.features || { apiAccess: false, whiteLabel: false, customDomain: false, sso: false, maxTemplates: 2 },
      signatories: org.signatories || []
    });
    await this.repo.save(entity);
    return this.toDomain(entity);
  }

  async update(id: string, updates: Partial<Organisation>): Promise<Organisation | null> {
    await this.repo.update(id, updates as any);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.repo.delete(id);
    return (res.affected || 0) > 0;
  }

  private toDomain(e: OrganisationEntity): Organisation {
    return {
      id: e.id,
      name: e.name,
      code: e.code,
      domain: e.domain,
      department: e.department,
      logo: e.logo,
      badgeColor: e.badgeColor,
      plan: e.plan,
      status: e.status,
      certificateQuota: e.certificateQuota || { used: 0, total: 100 },
      signatories: e.signatories || [],
      features: e.features || { apiAccess: false, whiteLabel: false, customDomain: false, sso: false, maxTemplates: 2 },
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString()
    };
  }
}

export class TypeOrmUserRepository implements IUserRepository {
  private get repo() { return AppDataSource.getRepository(UserEntity); }

  async findAll(orgId?: string | null, params?: PaginationParams): Promise<PaginatedResult<AuthUser>> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(100, params?.limit || 20));
    const whereClause: any = {};
    if (orgId !== undefined && orgId !== null) {
      whereClause.organisationId = orgId;
    }
    const [items, total] = await this.repo.findAndCount({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' }
    });
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: items.map(this.toDomain),
      total,
      page,
      limit,
      totalPages
    };
  }

  async findById(id: string): Promise<AuthUser | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const entity = await this.repo.findOneBy({ email: email.toLowerCase() });
    return entity ? this.toDomain(entity) : null;
  }

  async create(user: AuthUser, passwordHash?: string): Promise<AuthUser> {
    const entity = this.repo.create({
      id: user.id,
      organisationId: user.organisationId ?? null,
      name: user.name,
      email: user.email.toLowerCase(),
      passwordHash: passwordHash || '$2b$10$demoHashedPasswordSaltExample',
      role: user.role,
      title: user.title || 'Officer',
      candidateId: user.candidateId ?? null,
      status: user.status || 'ACTIVE',
      twoFactorEnabled: user.twoFactorEnabled || false,
      permissions: user.permissions || [],
      lastLogin: user.lastLogin ? new Date(user.lastLogin) : null
    });
    await this.repo.save(entity);
    return this.toDomain(entity);
  }

  async update(id: string, updates: Partial<AuthUser> & { passwordHash?: string }): Promise<AuthUser | null> {
    const updateData: any = { ...updates };
    if (updates.email) updateData.email = updates.email.toLowerCase();
    if (updates.lastLogin) updateData.lastLogin = new Date(updates.lastLogin);
    if (updates.passwordHash) updateData.passwordHash = updates.passwordHash;
    await this.repo.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.repo.delete(id);
    return (res.affected || 0) > 0;
  }

  async validatePassword(identifier: string, passwordPlain: string): Promise<AuthUser | null> {
    const raw = identifier.trim();
    const isEmail = raw.includes('@');
    const candRepo = AppDataSource.getRepository(CandidateEntity);

    let userEntity: UserEntity | null = null;
    let candidateEntity: CandidateEntity | null = null;

    if (isEmail) {
      userEntity = await this.repo.findOneBy({ email: raw.toLowerCase() });
      candidateEntity = await candRepo.findOneBy({ email: raw.toLowerCase() });
    } else {
      // Identifier is Student ID or Username
      candidateEntity = await candRepo.createQueryBuilder('cand')
        .where('LOWER(cand.studentId) = LOWER(:id)', { id: raw })
        .orWhere('LOWER(cand.id) = LOWER(:id)', { id: raw })
        .getOne();

      if (candidateEntity) {
        userEntity = await this.repo.findOneBy({ email: candidateEntity.email.toLowerCase() });
        if (!userEntity) {
          userEntity = await this.repo.findOneBy({ candidateId: candidateEntity.id });
        }
      } else {
        userEntity = await this.repo.findOneBy({ id: raw });
      }
    }

    // If candidate has not claimed account yet (no user entity created), require them to claim first
    if (!userEntity) {
      return null;
    }

    // Once an account exists / password is set, strictly require the set private password.
    // Student ID as password or unverified passwords are not accepted.
    const passwordMatches = userEntity.passwordHash === passwordPlain;

    if (passwordMatches) {
      await this.repo.update(userEntity.id, { lastLogin: new Date() });
      return this.toDomain(userEntity);
    }
    return null;
  }

  private toDomain(e: UserEntity): AuthUser {
    return {
      id: e.id,
      name: e.name,
      email: e.email,
      role: e.role,
      organisationId: e.organisationId ?? null,
      title: e.title,
      candidateId: e.candidateId ?? null,
      status: e.status,
      twoFactorEnabled: e.twoFactorEnabled,
      permissions: e.permissions || [],
      lastLogin: e.lastLogin ? e.lastLogin.toISOString() : undefined,
      createdAt: e.createdAt.toISOString()
    };
  }
}

export class TypeOrmCandidateRepository implements ICandidateRepository {
  private get repo() { return AppDataSource.getRepository(CandidateEntity); }

  async findAll(orgId: string, params?: PaginationParams & { department?: string; status?: string }): Promise<PaginatedResult<Candidate>> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(100, params?.limit || 20));
    const where: any = { organisationId: orgId };
    if (params?.department) where.department = params.department;
    if (params?.status) where.status = params.status;

    const [items, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' }
    });
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: items.map(this.toDomain),
      total,
      page,
      limit,
      totalPages
    };
  }

  async findById(orgId: string, id: string): Promise<Candidate | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, id });
    return e ? this.toDomain(e) : null;
  }

  async findByEmail(orgId: string, email: string): Promise<Candidate | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, email: email.toLowerCase() });
    return e ? this.toDomain(e) : null;
  }

  async findByStudentId(orgId: string, studentId: string): Promise<Candidate | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, studentId });
    return e ? this.toDomain(e) : null;
  }

  async create(cand: Candidate): Promise<Candidate> {
    const entity = this.repo.create({
      id: cand.id,
      organisationId: cand.organisationId,
      name: cand.name,
      email: cand.email.toLowerCase(),
      studentId: cand.studentId,
      department: cand.department || 'Academic Division',
      enrolledCourseIds: cand.enrolledCourseIds || [],
      status: cand.status || 'Active'
    });
    await this.repo.save(entity);
    return this.toDomain(entity);
  }

  async bulkCreate(candidates: Candidate[]): Promise<Candidate[]> {
    const saved: Candidate[] = [];
    for (const c of candidates) {
      saved.push(await this.create(c));
    }
    return saved;
  }

  async update(orgId: string, id: string, updates: Partial<Candidate>): Promise<Candidate | null> {
    await this.repo.update({ organisationId: orgId, id }, updates as any);
    return this.findById(orgId, id);
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const res = await this.repo.delete({ organisationId: orgId, id });
    return (res.affected || 0) > 0;
  }

  private toDomain(e: CandidateEntity): Candidate {
    return {
      id: e.id,
      organisationId: e.organisationId,
      name: e.name,
      email: e.email,
      studentId: e.studentId,
      department: e.department,
      enrolledCourseIds: e.enrolledCourseIds || [],
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString()
    };
  }
}

export class TypeOrmDepartmentRepository implements IDepartmentRepository {
  private get repo() { return AppDataSource.getRepository(DepartmentEntity); }

  async findAll(orgId: string): Promise<Department[]> {
    const list = await this.repo.findBy({ organisationId: orgId });
    return list.map(e => ({
      id: e.id,
      organisationId: e.organisationId,
      name: e.name,
      code: e.code,
      headName: e.headName,
      createdAt: e.createdAt.toISOString()
    }));
  }

  async findById(orgId: string, id: string): Promise<Department | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, id });
    return e ? { id: e.id, organisationId: e.organisationId, name: e.name, code: e.code, headName: e.headName, createdAt: e.createdAt.toISOString() } : null;
  }

  async create(dept: Department): Promise<Department> {
    const entity = this.repo.create({
      id: dept.id,
      organisationId: dept.organisationId,
      name: dept.name,
      code: dept.code,
      headName: dept.headName || ''
    });
    await this.repo.save(entity);
    return { ...dept, createdAt: entity.createdAt.toISOString() };
  }

  async update(orgId: string, id: string, updates: Partial<Department>): Promise<Department | null> {
    await this.repo.update({ organisationId: orgId, id }, updates as any);
    return this.findById(orgId, id);
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const res = await this.repo.delete({ organisationId: orgId, id });
    return (res.affected || 0) > 0;
  }
}

export class TypeOrmCourseRepository implements ICourseRepository {
  private get repo() { return AppDataSource.getRepository(CourseEntity); }

  async findAll(orgId: string, params?: PaginationParams & { category?: string }): Promise<PaginatedResult<Course>> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(100, params?.limit || 20));
    const where: any = { organisationId: orgId };
    if (params?.category) where.category = params.category;

    const [items, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' }
    });
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: items.map(this.toDomain),
      total,
      page,
      limit,
      totalPages
    };
  }

  async findById(orgId: string, id: string): Promise<Course | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, id });
    return e ? this.toDomain(e) : null;
  }

  async findByCode(orgId: string, code: string): Promise<Course | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, code });
    return e ? this.toDomain(e) : null;
  }

  async create(course: Course): Promise<Course> {
    const entity = this.repo.create({
      id: course.id,
      organisationId: course.organisationId,
      name: course.name,
      code: course.code,
      duration: course.duration || '120 Hours',
      category: course.category || 'Academic',
      instructor: course.instructor || 'Lead Instructor',
      skills: course.skills || []
    });
    await this.repo.save(entity);
    return this.toDomain(entity);
  }

  async update(orgId: string, id: string, updates: Partial<Course>): Promise<Course | null> {
    await this.repo.update({ organisationId: orgId, id }, updates as any);
    return this.findById(orgId, id);
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const res = await this.repo.delete({ organisationId: orgId, id });
    return (res.affected || 0) > 0;
  }

  private toDomain(e: CourseEntity): Course {
    return {
      id: e.id,
      organisationId: e.organisationId,
      name: e.name,
      code: e.code,
      duration: e.duration,
      category: e.category,
      instructor: e.instructor,
      skills: e.skills || [],
      createdAt: e.createdAt.toISOString()
    };
  }
}

export class TypeOrmTemplateRepository implements ITemplateRepository {
  private get repo() { return AppDataSource.getRepository(TemplateEntity); }
  private get versionRepo() { return AppDataSource.getRepository(TemplateVersionEntity); }

  async findAll(orgId: string): Promise<CertificateTemplate[]> {
    const list = await this.repo.find({
      where: { organisationId: orgId },
      order: { createdAt: 'DESC' }
    });
    return list.map(this.toDomain);
  }

  async findById(orgId: string, id: string): Promise<CertificateTemplate | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, id });
    return e ? this.toDomain(e) : null;
  }

  async create(template: CertificateTemplate): Promise<CertificateTemplate> {
    const entity = this.repo.create({
      id: template.id,
      organisationId: template.organisationId,
      name: template.name,
      description: template.description || 'Vector template layout',
      theme: template.theme || 'classic-diploma',
      tags: template.tags || ['Custom'],
      status: template.status || 'PUBLISHED',
      activeVersionId: template.activeVersionId || 'VER_001',
      schema: template.schema
    });
    await this.repo.save(entity);
    return this.toDomain(entity);
  }

  async update(orgId: string, id: string, updates: Partial<CertificateTemplate>): Promise<CertificateTemplate | null> {
    let existing = await this.repo.findOneBy({ organisationId: orgId, id });
    if (!existing) {
      existing = this.repo.create({
        id,
        organisationId: orgId,
        name: updates.name || 'Custom Template',
        description: updates.description || 'Vector layout',
        theme: updates.theme || 'classic-diploma',
        tags: updates.tags || ['Custom'],
        status: updates.status || 'PUBLISHED',
        activeVersionId: updates.activeVersionId || 'VER_001',
        schema: updates.schema
      });
      await this.repo.save(existing);
      return this.toDomain(existing);
    }
    await this.repo.update({ organisationId: orgId, id }, updates as any);
    return this.findById(orgId, id);
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const res = await this.repo.delete({ organisationId: orgId, id });
    return (res.affected || 0) > 0;
  }

  async findVersions(templateId: string): Promise<TemplateVersion[]> {
    const list = await this.versionRepo.find({
      where: { templateId },
      order: { versionNumber: 'ASC' }
    });
    return list.map(v => ({
      id: v.id,
      templateId: v.templateId,
      versionNumber: v.versionNumber,
      schema: v.schema,
      changelog: v.changelog,
      publishedBy: v.publishedBy,
      publishedAt: v.publishedAt.toISOString()
    }));
  }

  async findVersionById(templateId: string, versionId: string): Promise<TemplateVersion | null> {
    const v = await this.versionRepo.findOneBy({ templateId, id: versionId });
    return v ? {
      id: v.id,
      templateId: v.templateId,
      versionNumber: v.versionNumber,
      schema: v.schema,
      changelog: v.changelog,
      publishedBy: v.publishedBy,
      publishedAt: v.publishedAt.toISOString()
    } : null;
  }

  async createVersion(version: TemplateVersion): Promise<TemplateVersion> {
    const entity = this.versionRepo.create({
      id: version.id,
      templateId: version.templateId,
      versionNumber: version.versionNumber,
      schema: version.schema,
      changelog: version.changelog,
      publishedBy: version.publishedBy
    });
    await this.versionRepo.save(entity);
    return version;
  }

  private toDomain(e: TemplateEntity): CertificateTemplate {
    return {
      id: e.id,
      organisationId: e.organisationId,
      name: e.name,
      description: e.description,
      theme: e.theme,
      tags: e.tags || [],
      status: e.status,
      activeVersionId: e.activeVersionId,
      schema: e.schema,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString()
    };
  }
}

export class TypeOrmCredentialRepository implements ICredentialRepository {
  private get repo() { return AppDataSource.getRepository(CredentialEntity); }

  async findAll(orgId?: string | null, params?: PaginationParams & { status?: string; courseId?: string; candidateId?: string }): Promise<PaginatedResult<Credential>> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(100, params?.limit || 20));
    const where: any = {};
    if (orgId) where.organisationId = orgId;
    if (params?.status) where.status = params.status;
    if (params?.courseId) where.courseId = params.courseId;
    if (params?.candidateId) where.candidateId = params.candidateId;

    const [items, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' }
    });
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: items.map(this.toDomain),
      total,
      page,
      limit,
      totalPages
    };
  }

  async findById(id: string): Promise<Credential | null> {
    const e = await this.repo.findOne({
      where: [{ id }, { certificateNumber: id }]
    });
    return e ? this.toDomain(e) : null;
  }

  async findByCertificateNumber(certNum: string): Promise<Credential | null> {
    const e = await this.repo.findOneBy({ certificateNumber: certNum });
    return e ? this.toDomain(e) : null;
  }

  async findByCandidate(candidateId: string): Promise<Credential[]> {
    const list = await this.repo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' }
    });
    return list.map(this.toDomain);
  }

  async create(cred: Credential): Promise<Credential> {
    const entity = this.repo.create({
      id: cred.id,
      certificateNumber: cred.certificateNumber,
      organisationId: cred.organisationId,
      candidateId: cred.candidateId,
      candidateName: cred.candidateName,
      candidateEmail: cred.candidateEmail,
      courseId: cred.courseId,
      courseName: cred.courseName,
      templateId: cred.templateId,
      templateVersionId: cred.templateVersionId || 'VER_001',
      issueDate: cred.issueDate,
      completionDate: cred.completionDate,
      expiryDate: cred.expiryDate,
      status: cred.status || 'ACTIVE',
      score: cred.score || '98%',
      grade: cred.grade || 'Honors & Distinction',
      skills: cred.skills || [],
      description: cred.description || '',
      verificationUrl: cred.verificationUrl,
      hashDigest: cred.hashDigest,
      signatureData: cred.signatureData
    });
    await this.repo.save(entity);
    return this.toDomain(entity);
  }

  async bulkCreate(credentials: Credential[]): Promise<Credential[]> {
    const saved: Credential[] = [];
    for (const c of credentials) {
      saved.push(await this.create(c));
    }
    return saved;
  }

  async update(id: string, updates: Partial<Credential>): Promise<Credential | null> {
    await this.repo.update({ id }, updates as any);
    return this.findById(id);
  }

  async revoke(id: string, reason: string, revokedBy: string): Promise<Credential | null> {
    await this.repo.update({ id }, {
      status: 'REVOKED',
      revocationReason: reason,
      revokedAt: new Date(),
      revokedBy
    });
    return this.findById(id);
  }

  private toDomain(e: CredentialEntity): Credential {
    return {
      id: e.id,
      certificateNumber: e.certificateNumber,
      organisationId: e.organisationId,
      candidateId: e.candidateId,
      candidateName: e.candidateName,
      candidateEmail: e.candidateEmail,
      courseId: e.courseId,
      courseName: e.courseName,
      templateId: e.templateId,
      templateVersionId: e.templateVersionId,
      issueDate: e.issueDate,
      completionDate: e.completionDate,
      expiryDate: e.expiryDate,
      status: e.status,
      score: e.score,
      grade: e.grade,
      skills: e.skills || [],
      description: e.description,
      verificationUrl: e.verificationUrl,
      hashDigest: e.hashDigest,
      signatureData: e.signatureData,
      revocationReason: e.revocationReason || undefined,
      revokedAt: e.revokedAt ? e.revokedAt.toISOString() : undefined,
      revokedBy: e.revokedBy || undefined,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString()
    };
  }
}

export class TypeOrmCertificateJobRepository implements ICertificateJobRepository {
  private get repo() { return AppDataSource.getRepository(CertificateJobEntity); }

  async findById(orgId: string, jobId: string): Promise<CertificateJob | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, id: jobId });
    return e ? {
      id: e.id,
      organisationId: e.organisationId,
      courseId: e.courseId,
      templateVersionId: e.templateVersionId,
      createdBy: e.createdBy,
      status: (e.status as any) || 'PROCESSING',
      totalCount: e.totalCount,
      processedCount: e.processedCount,
      successCount: e.successCount,
      failedCount: e.failedCount,
      generatedCredentialIds: e.generatedCredentialIds || [],
      errors: e.errors || [],
      startedAt: e.startedAt ? e.startedAt.toISOString() : undefined,
      completedAt: e.completedAt ? e.completedAt.toISOString() : undefined,
      createdAt: e.createdAt.toISOString()
    } : null;
  }

  async create(job: CertificateJob): Promise<CertificateJob> {
    const entity = this.repo.create({
      id: job.id,
      organisationId: job.organisationId,
      courseId: job.courseId,
      templateVersionId: job.templateVersionId,
      createdBy: job.createdBy,
      status: (job.status as any) || 'PROCESSING',
      totalCount: job.totalCount,
      processedCount: job.processedCount,
      successCount: job.successCount,
      failedCount: job.failedCount,
      generatedCredentialIds: job.generatedCredentialIds || [],
      errors: job.errors || []
    });
    await this.repo.save(entity);
    return job;
  }

  async update(jobId: string, updates: Partial<CertificateJob>): Promise<CertificateJob | null> {
    await this.repo.update({ id: jobId }, updates as any);
    const e = await this.repo.findOneBy({ id: jobId });
    return e ? (e as any) : null;
  }
}

export class TypeOrmAuditLogRepository implements IAuditLogRepository {
  private get repo() { return AppDataSource.getRepository(AuditLogEntity); }

  async findAll(orgId?: string | null, params?: PaginationParams & { action?: string; actor?: string }): Promise<PaginatedResult<AuditLog>> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(100, params?.limit || 50));
    const where: any = {};
    if (orgId) where.organisationId = orgId;
    if (params?.action) where.action = params.action;

    const [items, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { timestamp: 'DESC' }
    });
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: items.map(e => ({
        id: e.id,
        organisationId: e.organisationId ?? null,
        actorId: e.actorId,
        actor: e.actor,
        actorRole: e.actorRole as any,
        action: e.action,
        targetType: e.targetType as any,
        targetId: e.targetId,
        details: e.details,
        ipAddress: e.ipAddress,
        timestamp: e.timestamp.toISOString()
      })),
      total,
      page,
      limit,
      totalPages
    };
  }

  async create(log: AuditLog): Promise<AuditLog> {
    const entity = this.repo.create({
      id: log.id,
      organisationId: log.organisationId,
      actorId: log.actorId,
      actor: log.actor,
      actorRole: log.actorRole,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details,
      ipAddress: log.ipAddress || '127.0.0.1'
    });
    await this.repo.save(entity);
    return log;
  }
}

export class TypeOrmEmailLogRepository implements IEmailLogRepository {
  private get repo() { return AppDataSource.getRepository(EmailLogEntity); }

  async findAll(orgId: string, params?: PaginationParams & { status?: string }): Promise<PaginatedResult<EmailLog>> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(100, params?.limit || 50));
    const where: any = { organisationId: orgId };
    if (params?.status) where.status = params.status;

    const [items, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { sentAt: 'DESC' }
    });
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: items.map(e => ({
        id: e.id,
        organisationId: e.organisationId,
        credentialId: e.credentialId,
        recipientEmail: e.recipientEmail,
        recipientName: e.recipientName,
        subject: e.subject,
        status: e.status,
        sentAt: e.sentAt.toISOString(),
        createdAt: e.sentAt.toISOString()
      })),
      total,
      page,
      limit,
      totalPages
    };
  }

  async findById(orgId: string, id: string): Promise<EmailLog | null> {
    const e = await this.repo.findOneBy({ organisationId: orgId, id });
    return e ? {
      id: e.id,
      organisationId: e.organisationId,
      credentialId: e.credentialId,
      recipientEmail: e.recipientEmail,
      recipientName: e.recipientName,
      subject: e.subject,
      status: e.status,
      sentAt: e.sentAt.toISOString(),
      createdAt: e.sentAt.toISOString()
    } : null;
  }

  async create(log: EmailLog): Promise<EmailLog> {
    const entity = this.repo.create({
      id: log.id,
      organisationId: log.organisationId,
      credentialId: log.credentialId,
      recipientEmail: log.recipientEmail,
      recipientName: log.recipientName,
      subject: log.subject,
      status: log.status
    });
    await this.repo.save(entity);
    return log;
  }

  async update(orgId: string, id: string, updates: Partial<EmailLog>): Promise<EmailLog | null> {
    await this.repo.update({ organisationId: orgId, id }, updates as any);
    return this.findById(orgId, id);
  }
}

export class TypeOrmSubscriptionRepository implements ISubscriptionRepository {
  private get repo() { return AppDataSource.getRepository(SubscriptionPlanEntity); }
  private get orgRepo() { return AppDataSource.getRepository(OrganisationEntity); }

  async findAllPlans(): Promise<SubscriptionPlan[]> {
    const list = await this.repo.find();
    if (list.length === 0) {
      for (const p of SEED_SUBSCRIPTION_PLANS) {
        await this.repo.save(this.repo.create(p));
      }
      return SEED_SUBSCRIPTION_PLANS;
    }
    return list.map(p => ({
      id: p.id,
      name: p.name,
      tier: p.tier,
      monthlyPriceCents: p.monthlyPriceCents,
      annualPriceCents: p.annualPriceCents,
      certificateQuota: p.certificateQuota,
      features: p.features
    }));
  }

  async findPlanByTier(tier: string): Promise<SubscriptionPlan | null> {
    const plans = await this.findAllPlans();
    return plans.find(p => p.tier.toLowerCase() === tier.toLowerCase()) || null;
  }

  async getUsage(orgId: string): Promise<{ used: number; total: number; percentage: number }> {
    const org = await this.orgRepo.findOneBy({ id: orgId });
    if (!org) return { used: 0, total: 100, percentage: 0 };
    const used = org.certificateQuota?.used || 0;
    const total = org.certificateQuota?.total || 100;
    return {
      used,
      total,
      percentage: total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
    };
  }

  async updatePlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | null> {
    const existing = await this.repo.findOneBy({ id });
    if (!existing) return null;
    const merged = {
      ...existing,
      ...updates,
      features: { ...existing.features, ...(updates.features || {}) }
    };
    await this.repo.save(this.repo.create(merged));
    return merged as any;
  }
}

export class TypeOrmPlatformSettingsRepository implements IPlatformSettingsRepository {
  private memorySettings: Record<string, any> = {
    'platform:name': 'iCertiX Sovereign Enterprise',
    'platform:maintenance': false,
    'platform:allowRegistration': true
  };

  async getAll(): Promise<Record<string, any>> {
    return { ...this.memorySettings };
  }

  async get(key: string): Promise<any> {
    return this.memorySettings[key];
  }

  async set(key: string, value: any, _updatedBy?: string): Promise<void> {
    this.memorySettings[key] = value;
  }
}

export const AppRepositories = {
  organisations: new TypeOrmOrganisationRepository(),
  users: new TypeOrmUserRepository(),
  candidates: new TypeOrmCandidateRepository(),
  departments: new TypeOrmDepartmentRepository(),
  courses: new TypeOrmCourseRepository(),
  templates: new TypeOrmTemplateRepository(),
  credentials: new TypeOrmCredentialRepository(),
  certificateJobs: new TypeOrmCertificateJobRepository(),
  auditLogs: new TypeOrmAuditLogRepository(),
  emailLogs: new TypeOrmEmailLogRepository(),
  subscriptions: new TypeOrmSubscriptionRepository(),
  settings: new TypeOrmPlatformSettingsRepository(),
  platformSettings: new TypeOrmPlatformSettingsRepository(),

  // Root bootstrap hook
  async initializeDatabase(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('[TypeORM] Connected to PostgreSQL at', process.env.DATABASE_URL || 'localhost:5432');
    }

    // Seed default subscription plans if empty
    const planRepo = AppDataSource.getRepository(SubscriptionPlanEntity);
    const planCount = await planRepo.count();
    if (planCount === 0) {
      for (const p of SEED_SUBSCRIPTION_PLANS) {
        await planRepo.save(planRepo.create(p));
      }
    }

    // Ensure root Super Admin bootstrap user exists
    const userRepo = AppDataSource.getRepository(UserEntity);
    const superAdmin = await userRepo.findOneBy({ email: 'superadmin@icertix.demo' });
    if (!superAdmin) {
      for (const u of SEED_USERS) {
        await userRepo.save(userRepo.create({
          id: u.id,
          organisationId: u.organisationId ?? null,
          name: u.name,
          email: u.email,
          passwordHash: 'password123',
          role: u.role,
          title: u.title,
          status: 'ACTIVE',
          twoFactorEnabled: true,
          permissions: ['*']
        }));
      }
      console.log('[TypeORM] Bootstrapped root Super Administrator account (superadmin@icertix.demo).');
    }
  }
};

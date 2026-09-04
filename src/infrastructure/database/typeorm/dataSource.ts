import 'reflect-metadata';
import { DataSource } from 'typeorm';
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

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:0000@localhost:5432/icertix_db';
const isProduction = process.env.NODE_ENV === 'production';
const enableSsl = process.env.DB_SSL === 'true' || (isProduction && !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1'));

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  synchronize: process.env.DB_SYNCHRONIZE === 'false' ? false : true,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
  ssl: enableSsl ? { rejectUnauthorized: false } : false,
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  },
  entities: [
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
  ],
  migrations: [],
  subscribers: []
});

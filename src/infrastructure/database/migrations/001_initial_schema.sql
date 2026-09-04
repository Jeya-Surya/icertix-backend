-- =============================================================================
-- iCertiX - PostgreSQL Schema Migration: 001_initial_schema.sql
-- Enterprise Digital Credential & Certificate Generation Multi-Tenant Platform
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. ENUMS & DOMAINS
-- -----------------------------------------------------------------------------

CREATE TYPE user_role_enum AS ENUM (
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'ORG_ADMIN',
    'ORG_STAFF',
    'AUDITOR',
    'CANDIDATE',
    'PUBLIC_VERIFIER'
);

CREATE TYPE credential_status_enum AS ENUM (
    'DRAFT',
    'PROCESSING',
    'ACTIVE',
    'REVOKED',
    'EXPIRED',
    'SUSPENDED',
    'INVALID'
);

CREATE TYPE plan_tier_enum AS ENUM (
    'FREE',
    'PROFESSIONAL',
    'ENTERPRISE'
);

CREATE TYPE job_status_enum AS ENUM (
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'RETRYING'
);

CREATE TYPE email_status_enum AS ENUM (
    'QUEUED',
    'SENT',
    'DELIVERED',
    'OPENED',
    'BOUNCED',
    'FAILED'
);

-- -----------------------------------------------------------------------------
-- 2. ORGANISATIONS (Tenants)
-- -----------------------------------------------------------------------------

CREATE TABLE organisations (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('ORG_' || substr(md5(random()::text), 1, 8)),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    domain VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    logo VARCHAR(255),
    badge_color VARCHAR(32) DEFAULT '#0A2540',
    plan plan_tier_enum NOT NULL DEFAULT 'PROFESSIONAL',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING')),
    quota_used INTEGER NOT NULL DEFAULT 0,
    quota_total INTEGER NOT NULL DEFAULT 1000,
    features JSONB NOT NULL DEFAULT '{"apiAccess": true, "whiteLabel": false, "customDomain": false, "sso": false, "maxTemplates": 10}'::jsonb,
    signatories JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organisations_code ON organisations(code);
CREATE INDEX idx_organisations_status ON organisations(status);

-- -----------------------------------------------------------------------------
-- 3. USERS (Platform-wide and Tenant-scoped)
-- -----------------------------------------------------------------------------

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('USER-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) REFERENCES organisations(id) ON DELETE SET NULL, -- NULL for SUPER_ADMIN
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'ORG_STAFF',
    title VARCHAR(255),
    avatar VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    candidate_id VARCHAR(64),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org ON users(organisation_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- -----------------------------------------------------------------------------
-- 4. DEPARTMENTS & ACADEMIC UNITS
-- -----------------------------------------------------------------------------

CREATE TABLE departments (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('DEPT-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    head_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dept_org_code UNIQUE (organisation_id, code)
);

CREATE INDEX idx_departments_org ON departments(organisation_id);

-- -----------------------------------------------------------------------------
-- 5. COURSES & ACADEMIC PROGRAMS
-- -----------------------------------------------------------------------------

CREATE TABLE courses (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('CRS-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    duration VARCHAR(64) NOT NULL,
    category VARCHAR(128) NOT NULL,
    instructor VARCHAR(255) NOT NULL,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_org_code UNIQUE (organisation_id, code)
);

CREATE INDEX idx_courses_org ON courses(organisation_id);
CREATE INDEX idx_courses_category ON courses(category);

-- -----------------------------------------------------------------------------
-- 6. CANDIDATES & RECIPIENTS
-- -----------------------------------------------------------------------------

CREATE TABLE candidates (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('CAN-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    department VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Invited', 'Completed', 'Archived')),
    avatar VARCHAR(512),
    enrolled_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candidate_org_email UNIQUE (organisation_id, email),
    CONSTRAINT uq_candidate_org_student_id UNIQUE (organisation_id, student_id)
);

CREATE INDEX idx_candidates_org ON candidates(organisation_id);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_candidates_student_id ON candidates(student_id);

-- -----------------------------------------------------------------------------
-- 7. CERTIFICATE TEMPLATES & IMMUTABLE VERSIONS
-- -----------------------------------------------------------------------------

CREATE TABLE certificate_templates (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('TPL-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    theme VARCHAR(64) NOT NULL DEFAULT 'modern-minimal',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    active_version_id VARCHAR(64),
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_org ON certificate_templates(organisation_id);

CREATE TABLE template_versions (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('VER-' || substr(md5(random()::text), 1, 8)),
    template_id VARCHAR(64) NOT NULL REFERENCES certificate_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    schema JSONB NOT NULL, -- Structured Canva-style visual design schema
    changelog TEXT,
    published_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_template_version_num UNIQUE (template_id, version_number)
);

CREATE INDEX idx_template_versions_tpl ON template_versions(template_id);

-- Add foreign key back to active version in template
ALTER TABLE certificate_templates 
ADD CONSTRAINT fk_tpl_active_version 
FOREIGN KEY (active_version_id) REFERENCES template_versions(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 8. AUTHORITATIVE CREDENTIALS (Tamper-proof Digital Records)
-- -----------------------------------------------------------------------------

CREATE TABLE credentials (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'ICX-2026-7F8A91C2' (Authoritative ID)
    certificate_number VARCHAR(64) NOT NULL UNIQUE,
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
    candidate_id VARCHAR(64) NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
    candidate_name VARCHAR(255) NOT NULL,
    candidate_email VARCHAR(255) NOT NULL,
    course_id VARCHAR(64) NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    course_name VARCHAR(255) NOT NULL,
    template_id VARCHAR(64) NOT NULL REFERENCES certificate_templates(id) ON DELETE RESTRICT,
    template_version_id VARCHAR(64) NOT NULL REFERENCES template_versions(id) ON DELETE RESTRICT,
    issue_date DATE NOT NULL,
    completion_date DATE NOT NULL,
    expiry_date DATE,
    status credential_status_enum NOT NULL DEFAULT 'ACTIVE',
    score VARCHAR(32),
    grade VARCHAR(64),
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT,
    verification_url VARCHAR(512) NOT NULL,
    hash_digest VARCHAR(128) NOT NULL, -- SHA-256 canonical payload digest
    signature_data JSONB NOT NULL, -- { algorithm, signature, keyId, timestamp }
    revocation_reason TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credentials_org ON credentials(organisation_id);
CREATE INDEX idx_credentials_candidate ON credentials(candidate_id);
CREATE INDEX idx_credentials_course ON credentials(course_id);
CREATE INDEX idx_credentials_status ON credentials(status);
CREATE INDEX idx_credentials_hash ON credentials(hash_digest);
CREATE INDEX idx_credentials_issue_date ON credentials(issue_date);

-- -----------------------------------------------------------------------------
-- 9. CERTIFICATE JOBS (Bulk Issuance Queue)
-- -----------------------------------------------------------------------------

CREATE TABLE certificate_jobs (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('JOB-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    template_version_id VARCHAR(64) NOT NULL REFERENCES template_versions(id) ON DELETE RESTRICT,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    status job_status_enum NOT NULL DEFAULT 'QUEUED',
    total_count INTEGER NOT NULL DEFAULT 0,
    processed_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    generated_credential_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_org ON certificate_jobs(organisation_id);
CREATE INDEX idx_jobs_status ON certificate_jobs(status);

-- -----------------------------------------------------------------------------
-- 10. PUBLIC VERIFICATION LOGS
-- -----------------------------------------------------------------------------

CREATE TABLE verification_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('VERLOG-' || substr(md5(random()::text), 1, 8)),
    credential_id VARCHAR(64) NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    ip_address VARCHAR(64),
    user_agent TEXT,
    referrer VARCHAR(512),
    status_at_check credential_status_enum NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT TRUE,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ver_logs_credential ON verification_logs(credential_id);
CREATE INDEX idx_ver_logs_checked_at ON verification_logs(checked_at);

-- -----------------------------------------------------------------------------
-- 11. AUDIT LOGS (Immutable Activity Trail)
-- -----------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('AUD-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) REFERENCES organisations(id) ON DELETE SET NULL,
    actor_id VARCHAR(64),
    actor_name VARCHAR(255) NOT NULL,
    actor_role user_role_enum NOT NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(64),
    details TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(64) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organisation_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- -----------------------------------------------------------------------------
-- 12. EMAIL LOGS & DELIVERY STATUS
-- -----------------------------------------------------------------------------

CREATE TABLE email_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('EML-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    credential_id VARCHAR(64) REFERENCES credentials(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    subject VARCHAR(512) NOT NULL,
    status email_status_enum NOT NULL DEFAULT 'QUEUED',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_logs_org ON email_logs(organisation_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- -----------------------------------------------------------------------------
-- 13. SUBSCRIPTIONS & USAGE TRACKING
-- -----------------------------------------------------------------------------

CREATE TABLE subscription_plans (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    tier plan_tier_enum NOT NULL UNIQUE,
    monthly_price_cents INTEGER NOT NULL DEFAULT 0,
    annual_price_cents INTEGER NOT NULL DEFAULT 0,
    certificate_quota INTEGER NOT NULL,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organisation_subscriptions (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('SUB-' || substr(md5(random()::text), 1, 8)),
    organisation_id VARCHAR(64) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    plan_tier plan_tier_enum NOT NULL DEFAULT 'PROFESSIONAL',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 14. PLATFORM SYSTEM SETTINGS
-- -----------------------------------------------------------------------------

CREATE TABLE platform_settings (
    key VARCHAR(128) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

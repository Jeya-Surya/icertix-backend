-- =============================================================================
-- iCertiX Enterprise — Complete PostgreSQL Database Schema
-- Version: 3.0.0
-- Engine: PostgreSQL 15+
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMERATIONS
-- =============================================================================

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'ORG_STAFF',
  'AUDITOR',
  'CANDIDATE',
  'PUBLIC_VERIFIER'
);

CREATE TYPE subscription_plan AS ENUM (
  'Free',
  'Professional',
  'Enterprise'
);

CREATE TYPE organisation_status AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE',
  'PENDING_SETUP'
);

CREATE TYPE user_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'LOCKED',
  'PENDING_VERIFICATION'
);

CREATE TYPE credential_status AS ENUM (
  'DRAFT',
  'PROCESSING',
  'ACTIVE',
  'REVOKED',
  'EXPIRED',
  'SUSPENDED'
);

CREATE TYPE generation_job_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE email_status AS ENUM (
  'Queued',
  'Sent',
  'Delivered',
  'Opened',
  'Bounced',
  'Failed',
  'Unsubscribed'
);

CREATE TYPE template_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE verification_result AS ENUM (
  'VALID',
  'INVALID',
  'REVOKED',
  'EXPIRED',
  'NOT_FOUND',
  'TAMPERED'
);

-- =============================================================================
-- PLATFORM LAYER — Platform-wide tables (not organisation-scoped)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organisations (Tenant Registry)
-- -----------------------------------------------------------------------------
CREATE TABLE organisations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  code              VARCHAR(100) NOT NULL UNIQUE,
  domain            VARCHAR(255) NOT NULL,
  department        VARCHAR(255),
  logo              VARCHAR(10) DEFAULT '🏛',
  badge_color       VARCHAR(20) DEFAULT '#1E40AF',
  plan              subscription_plan NOT NULL DEFAULT 'Free',
  status            organisation_status NOT NULL DEFAULT 'PENDING_SETUP',
  quota_total       INTEGER NOT NULL DEFAULT 100,
  quota_used        INTEGER NOT NULL DEFAULT 0,
  website           VARCHAR(500),
  phone             VARCHAR(50),
  address           JSONB,                  -- { street, city, country, postal }
  settings          JSONB DEFAULT '{}',    -- org-specific config flags
  metadata          JSONB DEFAULT '{}',    -- extensible metadata
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at      TIMESTAMPTZ,
  suspended_reason  TEXT,
  created_by        UUID                   -- SUPER_ADMIN who created this org
);

CREATE INDEX idx_organisations_code ON organisations(code);
CREATE INDEX idx_organisations_status ON organisations(status);
CREATE INDEX idx_organisations_plan ON organisations(plan);

-- -----------------------------------------------------------------------------
-- Users (All roles, all orgs + platform users)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id       UUID REFERENCES organisations(id) ON DELETE SET NULL,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  name                  VARCHAR(255) NOT NULL,
  title                 VARCHAR(255),
  role                  user_role NOT NULL DEFAULT 'ORG_STAFF',
  status                user_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  password_hash         VARCHAR(255) NOT NULL,     -- bcrypt hash
  two_factor_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret     VARCHAR(255),              -- TOTP secret (encrypted)
  last_login            TIMESTAMPTZ,
  login_count           INTEGER NOT NULL DEFAULT 0,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  email_verify_token    VARCHAR(255),
  password_reset_token  VARCHAR(255),
  password_reset_expiry TIMESTAMPTZ,
  avatar_url            VARCHAR(500),
  preferences           JSONB DEFAULT '{}',
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organisation_id ON users(organisation_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- -----------------------------------------------------------------------------
-- Auth Tokens (JWT refresh token registry)
-- -----------------------------------------------------------------------------
CREATE TABLE auth_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255) NOT NULL UNIQUE,     -- SHA-256 of the token
  expires_at      TIMESTAMPTZ NOT NULL,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  ip_address      INET,
  user_agent      TEXT,
  device_name     VARCHAR(255)
);

CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX idx_auth_tokens_token_hash ON auth_tokens(token_hash);
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- Subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL UNIQUE REFERENCES organisations(id) ON DELETE CASCADE,
  plan            subscription_plan NOT NULL DEFAULT 'Free',
  quota_total     INTEGER NOT NULL DEFAULT 100,
  quota_used      INTEGER NOT NULL DEFAULT 0,
  billing_email   VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  trial_ends_at   TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ORG LAYER — Organisation-scoped tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Departments
-- -----------------------------------------------------------------------------
CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(100),
  description     TEXT,
  head_of_dept    VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, code)
);

CREATE INDEX idx_departments_org ON departments(organisation_id);

-- -----------------------------------------------------------------------------
-- Courses / Programmes
-- -----------------------------------------------------------------------------
CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  name            VARCHAR(500) NOT NULL,
  code            VARCHAR(100),
  description     TEXT,
  level           VARCHAR(100),          -- e.g., 'Postgraduate', 'Professional'
  duration        VARCHAR(100),          -- e.g., '12 Weeks'
  credit_hours    INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, code)
);

CREATE INDEX idx_courses_org ON courses(organisation_id);
CREATE INDEX idx_courses_dept ON courses(department_id);

-- -----------------------------------------------------------------------------
-- Signatories (Certificate co-signers)
-- -----------------------------------------------------------------------------
CREATE TABLE signatories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  signature_url   VARCHAR(500),          -- URL to signature image
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signatories_org ON signatories(organisation_id);

-- -----------------------------------------------------------------------------
-- Candidates
-- -----------------------------------------------------------------------------
CREATE TABLE candidates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  student_id      VARCHAR(100),
  department      VARCHAR(255),
  phone           VARCHAR(50),
  nationality     VARCHAR(100),
  date_of_birth   DATE,
  address         TEXT,
  tags            VARCHAR(255)[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, email),
  UNIQUE(organisation_id, student_id)
);

CREATE INDEX idx_candidates_org ON candidates(organisation_id);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_candidates_student_id ON candidates(student_id);

-- -----------------------------------------------------------------------------
-- Certificate Templates
-- -----------------------------------------------------------------------------
CREATE TABLE certificate_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            VARCHAR(500) NOT NULL,
  description     TEXT,
  status          template_status NOT NULL DEFAULT 'DRAFT',
  orientation     VARCHAR(20) NOT NULL DEFAULT 'landscape', -- 'landscape' | 'portrait'
  width_mm        NUMERIC(6,2) NOT NULL DEFAULT 297,
  height_mm       NUMERIC(6,2) NOT NULL DEFAULT 210,
  canvas_json     JSONB NOT NULL DEFAULT '[]',       -- CanvasElement[] serialized
  thumbnail_url   VARCHAR(500),
  preview_url     VARCHAR(500),
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  use_count       INTEGER NOT NULL DEFAULT 0,
  version         INTEGER NOT NULL DEFAULT 1,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at    TIMESTAMPTZ,
  published_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_org ON certificate_templates(organisation_id);
CREATE INDEX idx_templates_status ON certificate_templates(status);

-- Template version history
CREATE TABLE template_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID NOT NULL REFERENCES certificate_templates(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  canvas_json     JSONB NOT NULL,
  snapshot_url    VARCHAR(500),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, version)
);

-- -----------------------------------------------------------------------------
-- Certificate Generation Jobs
-- -----------------------------------------------------------------------------
CREATE TABLE certificate_generation_jobs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  template_id           UUID NOT NULL REFERENCES certificate_templates(id),
  course_id             UUID NOT NULL REFERENCES courses(id),
  requested_by          UUID NOT NULL REFERENCES users(id),
  status                generation_job_status NOT NULL DEFAULT 'PENDING',
  total_candidates      INTEGER NOT NULL DEFAULT 0,
  processed_count       INTEGER NOT NULL DEFAULT 0,
  failed_count          INTEGER NOT NULL DEFAULT 0,
  grade                 VARCHAR(50),
  score                 NUMERIC(5,2),
  issue_date            DATE,
  expiry_date           DATE,
  send_email            BOOLEAN NOT NULL DEFAULT TRUE,
  custom_notes          TEXT,
  error_log             TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_jobs_org ON certificate_generation_jobs(organisation_id);
CREATE INDEX idx_gen_jobs_status ON certificate_generation_jobs(status);

-- Job → Candidate mapping (N:M with per-candidate status)
CREATE TABLE job_candidates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES certificate_generation_jobs(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status          generation_job_status NOT NULL DEFAULT 'PENDING',
  error_message   TEXT,
  credential_id   UUID,                          -- FK set after credential created
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

-- -----------------------------------------------------------------------------
-- Credentials (Issued Certificates)
-- -----------------------------------------------------------------------------
CREATE TABLE credentials (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credential_id       VARCHAR(100) NOT NULL UNIQUE,     -- Human-readable: CERT-HASH-XXXXX
  organisation_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  candidate_id        UUID NOT NULL REFERENCES candidates(id),
  course_id           UUID NOT NULL REFERENCES courses(id),
  template_id         UUID NOT NULL REFERENCES certificate_templates(id),
  job_id              UUID REFERENCES certificate_generation_jobs(id),
  
  -- Recipient snapshot (immutable, captured at issuance time)
  recipient_name      VARCHAR(255) NOT NULL,
  recipient_email     VARCHAR(255) NOT NULL,
  recipient_student_id VARCHAR(100),
  
  -- Issuer snapshot
  issuer_name         VARCHAR(255) NOT NULL,
  issuer_title        VARCHAR(255),
  
  -- Course snapshot
  course_name         VARCHAR(500) NOT NULL,
  course_code         VARCHAR(100),
  
  -- Certificate details
  title               VARCHAR(500) NOT NULL,
  grade               VARCHAR(50),
  score               NUMERIC(5,2),
  issue_date          DATE NOT NULL,
  expiry_date         DATE,
  
  -- Status
  status              credential_status NOT NULL DEFAULT 'ACTIVE',
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason   TEXT,
  
  -- Cryptographic integrity
  sha256_hash         VARCHAR(64) NOT NULL,             -- SHA-256 of canonical payload
  hmac_signature      VARCHAR(255) NOT NULL,            -- HMAC-SHA256 signature
  canonical_payload   TEXT NOT NULL,                    -- Signed canonical string
  
  -- Storage
  pdf_url             VARCHAR(500),
  svg_url             VARCHAR(500),
  thumbnail_url       VARCHAR(500),
  
  -- QR / Verification
  qr_code_url         VARCHAR(500),
  verification_url    VARCHAR(500) GENERATED ALWAYS AS (
                        'https://verify.icertix.app/v/' || credential_id
                      ) STORED,
  
  -- Metadata
  custom_notes        TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credentials_org ON credentials(organisation_id);
CREATE INDEX idx_credentials_candidate ON credentials(candidate_id);
CREATE INDEX idx_credentials_credential_id ON credentials(credential_id);
CREATE INDEX idx_credentials_status ON credentials(status);
CREATE INDEX idx_credentials_sha256 ON credentials(sha256_hash);

-- Verification event log
CREATE TABLE credential_verifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credential_id   UUID NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
  result          verification_result NOT NULL,
  verifier_ip     INET,
  verifier_agent  TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verifications_credential ON credential_verifications(credential_id);
CREATE INDEX idx_verifications_requested_at ON credential_verifications(requested_at);

-- =============================================================================
-- COMMUNICATION LAYER
-- =============================================================================

-- Email Delivery Log
CREATE TABLE email_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  credential_id   UUID REFERENCES credentials(id) ON DELETE SET NULL,
  candidate_id    UUID REFERENCES candidates(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name  VARCHAR(255),
  subject         TEXT NOT NULL,
  template_type   VARCHAR(100),               -- 'CERTIFICATE_ISSUED', 'RESEND', etc.
  status          email_status NOT NULL DEFAULT 'Queued',
  message_id      VARCHAR(255),               -- Provider message ID (SES, etc.)
  provider        VARCHAR(100) DEFAULT 'mock',
  open_count      INTEGER NOT NULL DEFAULT 0,
  click_count     INTEGER NOT NULL DEFAULT 0,
  last_event_at   TIMESTAMPTZ,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_logs_org ON email_logs(organisation_id);
CREATE INDEX idx_email_logs_credential ON email_logs(credential_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- =============================================================================
-- AUDIT & COMPLIANCE LAYER
-- =============================================================================

-- Immutable Audit Trail
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,  -- NULL for platform-level events
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  actor           VARCHAR(255) NOT NULL,                -- Name captured at time of action
  actor_role      user_role NOT NULL,
  action          VARCHAR(255) NOT NULL,
  resource_type   VARCHAR(100),                         -- 'credential', 'template', 'user', etc.
  target_id       VARCHAR(255),                         -- ID of the affected resource
  details         TEXT,
  old_value       JSONB,                                -- Previous state (for updates)
  new_value       JSONB,                                -- New state (for updates)
  ip_address      INET,
  user_agent      TEXT,
  request_id      VARCHAR(100),                         -- X-Request-ID header value
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs are INSERT-ONLY — no UPDATE or DELETE permitted on this table
-- Enforce with a trigger in production:
CREATE OR REPLACE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

CREATE INDEX idx_audit_logs_org ON audit_logs(organisation_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, target_id);

-- =============================================================================
-- TRIGGERS — Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organisations', 'users', 'departments', 'courses',
    'candidates', 'certificate_templates', 'credentials',
    'certificate_generation_jobs', 'subscriptions'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY — PostgreSQL RLS for true multi-tenant isolation
-- =============================================================================

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (example for candidates — repeat for all org-scoped tables):
CREATE POLICY candidates_tenant_isolation ON candidates
  USING (organisation_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY courses_tenant_isolation ON courses
  USING (organisation_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY templates_tenant_isolation ON certificate_templates
  USING (organisation_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY credentials_tenant_isolation ON credentials
  USING (organisation_id = current_setting('app.current_org_id')::UUID);

-- Platform admins bypass RLS
CREATE ROLE icertix_app_user;
CREATE ROLE icertix_platform_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO icertix_app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO icertix_platform_admin;
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE organisations IS 'Tenant registry — each row is an independent certificate-issuing institution';
COMMENT ON TABLE users IS 'All system users across all roles and all organisations';
COMMENT ON TABLE credentials IS 'Issued digital credentials — immutable once ACTIVE, append-only for revocation';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail — INSERT-ONLY by policy';
COMMENT ON TABLE certificate_templates IS 'Canvas-based certificate templates with JSONB element storage';
COMMENT ON TABLE certificate_generation_jobs IS 'Batch certificate generation jobs with per-candidate tracking';
COMMENT ON COLUMN credentials.sha256_hash IS 'SHA-256 hash of the canonical_payload string for integrity verification';
COMMENT ON COLUMN credentials.canonical_payload IS 'Deterministic JSON string of the credential at time of issuance — input to sha256_hash';

-- =============================================================================
-- Consolidated Database Schema
-- =============================================================================
-- This file contains all database schemas, tables, types, indexes, and triggers
-- for the Hubble application. This follows Supabase declarative schema best practices.

-- =============================================================================
-- Extensions
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Schemas
-- =============================================================================

-- Create all schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS connect;
CREATE SCHEMA IF NOT EXISTS system;
-- Note: clerk and clerk_dev schemas already exist and are managed by Clerk

-- =============================================================================
-- Enumerated Types
-- =============================================================================

-- Core types
DO $$ BEGIN
  CREATE TYPE core.organization_status_t AS ENUM (
    'provisioning',
    'ready',
    'suspended',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE core.provisioning_status_t AS ENUM (
    'pending',
    'running',
    'ready',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Connect types
DO $$ BEGIN
  CREATE TYPE connect.destination_status_t AS ENUM (
    'pending',
    'healthy',
    'unhealthy'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE connect.connection_status_t AS ENUM (
    'not_configured',
    'needs_auth',
    'syncing',
    'healthy',
    'paused',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- Core Tables
-- =============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS core.organizations (
  org_id     text PRIMARY KEY,
  slug       text UNIQUE NOT NULL,
  status     core.organization_status_t NOT NULL DEFAULT 'provisioning',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_organizations_org_id_format
    CHECK (org_id ~ '^org_[a-zA-Z0-9]+$'),
  CONSTRAINT chk_organizations_slug_format
    CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) >= 3)
);

-- Provisioning workflows table
CREATE TABLE IF NOT EXISTS core.provisioning_workflows (
  correlation_id          text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  org_id                  text NOT NULL REFERENCES core.organizations(org_id) ON DELETE CASCADE,
  status                  core.provisioning_status_t NOT NULL DEFAULT 'pending',
  md_db_name              text,
  md_sa_username          text,
  fivetran_destination_id text,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message           text,
  started_at              timestamptz NOT NULL DEFAULT now(),
  finished_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_provisioning_workflows_correlation_id_format
    CHECK (correlation_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  CONSTRAINT chk_provisioning_workflows_md_db_name_format
    CHECK (md_db_name IS NULL OR md_db_name ~ '^md_[a-z0-9_-]+$'),
  CONSTRAINT chk_provisioning_workflows_finished_after_started
    CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT chk_provisioning_workflows_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Organization quotas table
CREATE TABLE IF NOT EXISTS core.organization_quotas (
  org_id               text PRIMARY KEY REFERENCES core.organizations(org_id) ON DELETE CASCADE,
  max_connectors       integer,
  max_storage_gb_est   numeric(10,2),
  max_daily_rows       bigint,
  max_query_runtime_ms integer,
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_organization_quotas_positive CHECK (
    (max_connectors IS NULL OR max_connectors > 0) AND
    (max_storage_gb_est IS NULL OR max_storage_gb_est > 0) AND
    (max_daily_rows IS NULL OR max_daily_rows > 0) AND
    (max_query_runtime_ms IS NULL OR max_query_runtime_ms > 0)
  )
);

-- =============================================================================
-- Connect Tables
-- =============================================================================

-- Data destinations table
CREATE TABLE IF NOT EXISTS connect.data_destinations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  text NOT NULL REFERENCES core.organizations(org_id) ON DELETE CASCADE,
  md_db_name              text NOT NULL UNIQUE,
  md_token_ref            text NOT NULL,
  fivetran_destination_id text UNIQUE,
  status                  connect.destination_status_t NOT NULL DEFAULT 'pending',
  last_event_at           timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_data_destinations_per_org UNIQUE (org_id) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT chk_data_destinations_md_db_name_format
    CHECK (md_db_name ~ '^md_[a-z0-9_-]+$'),
  CONSTRAINT chk_data_destinations_md_token_ref_nonempty
    CHECK (length(md_token_ref) > 0)
);

-- Data connections table
CREATE TABLE IF NOT EXISTS connect.data_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  text NOT NULL REFERENCES core.organizations(org_id) ON DELETE CASCADE,
  source_type             text NOT NULL,
  fivetran_connector_id   text UNIQUE,
  schema_name             text,
  status                  connect.connection_status_t NOT NULL DEFAULT 'not_configured',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_data_connections_per_source UNIQUE (org_id, source_type) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT chk_data_connections_schema_name_nonempty
    CHECK (schema_name IS NULL OR length(schema_name) > 0)
);

-- Connector types table
CREATE TABLE IF NOT EXISTS connect.connector_types (
  code  text PRIMARY KEY,
  label text NOT NULL
);

-- =============================================================================
-- System Tables
-- =============================================================================

-- Audit events table
CREATE TABLE IF NOT EXISTS system.audit_events (
  id             bigserial PRIMARY KEY,
  event_seq      bigint NOT NULL,
  org_id         text NOT NULL REFERENCES core.organizations(org_id) ON DELETE CASCADE,
  provider       text NOT NULL,
  type           text NOT NULL,
  correlation_id text,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_on     date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,

  -- Constraints
  CONSTRAINT chk_audit_events_provider_nonempty CHECK (length(provider) > 0),
  CONSTRAINT chk_audit_events_type_nonempty CHECK (length(type) > 0),
  CONSTRAINT chk_audit_events_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

-- Secrets table
CREATE TABLE IF NOT EXISTS system.secrets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       text NOT NULL REFERENCES core.organizations(org_id) ON DELETE CASCADE,
  secret_name  text NOT NULL,
  secret_value text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_system_secrets_org_name UNIQUE (org_id, secret_name),
  CONSTRAINT chk_system_secrets_secret_name_nonempty CHECK (length(secret_name) > 0),
  CONSTRAINT chk_system_secrets_secret_value_nonempty CHECK (length(secret_value) > 0)
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS system.idempotency_keys (
  key           text PRIMARY KEY,
  org_id        text NOT NULL REFERENCES core.organizations(org_id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_result   jsonb,

  -- Constraints
  CONSTRAINT chk_system_idempotency_nonempty CHECK (length(key) > 0),
  CONSTRAINT chk_system_idempotency_last_result_object
    CHECK (last_result IS NULL OR jsonb_typeof(last_result) = 'object')
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS system.rate_limits (
  user_id      text NOT NULL,
  action       text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,

  -- Constraints
  CONSTRAINT pk_system_rate_limits PRIMARY KEY (user_id, action, window_start),
  CONSTRAINT chk_system_rate_limits_count_nonnegative CHECK (count >= 0)
);

-- =============================================================================
-- Chat Tables (Public Schema for Supabase Compatibility)
-- =============================================================================

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         text NOT NULL REFERENCES core.organizations(org_id) ON DELETE CASCADE,
  owner_user_id  text NOT NULL,
  title          text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at    timestamptz,
  model          text,
  system_prompt  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  org_id           text NOT NULL,
  owner_user_id    text NOT NULL,
  author_user_id   text,
  role             text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool', 'function')),
  content          jsonb NOT NULL DEFAULT '{}'::jsonb,
  text_content     text GENERATED ALWAYS AS (
    CASE
      WHEN jsonb_typeof(content) = 'string' THEN trim(both '"' FROM content::text)
      WHEN content ? 'text' THEN content->>'text'
      ELSE NULL
    END
  ) STORED,
  model            text,
  tool_name        text,
  tool_call_id     text,
  error            text,
  idempotency_key  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Clerk Tables (Already Exist - Managed by Clerk)
-- =============================================================================
-- Note: clerk.users, clerk.organizations, clerk.email_addresses, clerk.phone_numbers,
-- clerk.raw_objects, and their clerk_dev counterparts already exist and are managed by Clerk.
-- These are mirror tables that sync with Clerk's authentication system.

-- =============================================================================
-- Indexes
-- =============================================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug_lower ON core.organizations (lower(slug));
CREATE INDEX IF NOT EXISTS idx_organizations_status ON core.organizations (status);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON core.organizations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provisioning_workflows_org_created ON core.provisioning_workflows (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provisioning_workflows_status ON core.provisioning_workflows (status);
CREATE INDEX IF NOT EXISTS idx_provisioning_workflows_org_active ON core.provisioning_workflows (org_id, started_at DESC)
  WHERE status IN ('pending', 'running');

-- Connect indexes
CREATE INDEX IF NOT EXISTS idx_data_destinations_org ON connect.data_destinations (org_id);
CREATE INDEX IF NOT EXISTS idx_data_destinations_status ON connect.data_destinations (status);

CREATE INDEX IF NOT EXISTS idx_data_connections_org_status ON connect.data_connections (org_id, status);
CREATE INDEX IF NOT EXISTS idx_data_connections_org_created ON connect.data_connections (org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_data_connections_healthy ON connect.data_connections (org_id, updated_at DESC)
  WHERE status = 'healthy';

CREATE INDEX IF NOT EXISTS idx_connector_types_label ON connect.connector_types USING gin (label gin_trgm_ops);

-- System indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_events_correlation_seq ON system.audit_events (correlation_id, event_seq);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_correlation ON system.audit_events (org_id, correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON system.audit_events (type);
CREATE INDEX IF NOT EXISTS idx_audit_events_payload ON system.audit_events USING gin (payload);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_time ON system.audit_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_type_time ON system.audit_events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created_on ON system.audit_events (org_id, created_on);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_type_time ON system.audit_events (org_id, type, created_at DESC);

-- Unique index for vendor deduplication
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_events_vendor_dedupe
  ON system.audit_events (org_id, provider, (payload->>'id'))
  WHERE payload ? 'id';

CREATE INDEX IF NOT EXISTS idx_system_secrets_org_id ON system.secrets (org_id);
CREATE INDEX IF NOT EXISTS idx_system_secrets_name ON system.secrets (secret_name);
CREATE INDEX IF NOT EXISTS idx_system_secrets_org_name ON system.secrets (org_id, secret_name);

CREATE INDEX IF NOT EXISTS idx_system_idempotency_org ON system.idempotency_keys (org_id);
CREATE INDEX IF NOT EXISTS idx_system_idempotency_first_seen ON system.idempotency_keys (first_seen_at DESC);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_public_conversations_org ON public.conversations (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_conversations_owner ON public.conversations (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_public_conversations_org_updated ON public.conversations (org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_conversations_org_owner_updated ON public.conversations (org_id, owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_conversations_org_updated_active ON public.conversations (org_id, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_public_messages_conversation ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_public_messages_org ON public.messages (org_id);
CREATE INDEX IF NOT EXISTS idx_public_messages_org_owner_created ON public.messages (org_id, owner_user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_public_messages_conversation_created_ok ON public.messages (conversation_id, created_at ASC)
  WHERE error IS NULL;
CREATE INDEX IF NOT EXISTS idx_public_messages_org_role_time ON public.messages (org_id, role, created_at DESC);

-- Unique index for idempotency (partial index for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS uq_public_messages_conversation_idempotency
  ON public.messages (conversation_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Clerk indexes (already exist - managed by Clerk)
-- Note: Clerk manages its own indexes for optimal performance

-- =============================================================================
-- Foreign Key Constraints
-- =============================================================================

-- Connect foreign keys
DO $$ BEGIN
  ALTER TABLE connect.data_connections
    ADD CONSTRAINT fk_data_connections_source_type
    FOREIGN KEY (source_type) REFERENCES connect.connector_types(code);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- Comments
-- =============================================================================

-- Schema comments
COMMENT ON SCHEMA core IS 'Core business entities including organizations, provisioning workflows, and quotas';
COMMENT ON SCHEMA connect IS 'Data connection and integration features including destinations, connectors, and types';
COMMENT ON SCHEMA system IS 'System utilities including audit events, secrets, rate limiting, and idempotency';
-- Note: clerk and clerk_dev schemas are managed by Clerk

-- Table comments
COMMENT ON TABLE core.organizations IS 'Organization registry keyed by org_id; 1:1 with auth org';
COMMENT ON TABLE core.provisioning_workflows IS 'Tracks per-enable provisioning attempts per org (correlation_id/status/metadata)';
COMMENT ON TABLE core.organization_quotas IS 'Usage quotas and limits per organization';

COMMENT ON TABLE connect.data_destinations IS 'Per-organization MotherDuck DB + Fivetran destination metadata';
COMMENT ON TABLE connect.data_connections IS 'Per-organization Fivetran connectors (one per source_type)';
COMMENT ON TABLE connect.connector_types IS 'Allowed connector types; referenced by data_connections.source_type';

COMMENT ON TABLE system.audit_events IS 'Append-only event log (webhooks + system). created_on is UTC date via trigger.';
COMMENT ON TABLE system.secrets IS 'Secure secrets storage per organization';
COMMENT ON TABLE system.idempotency_keys IS 'Idempotency cache for long-running sagas';
COMMENT ON TABLE system.rate_limits IS 'Per-user action counters for rate limiting (server-only)';

COMMENT ON TABLE public.conversations IS 'Chat conversations per organization and user (public schema for Supabase client)';
COMMENT ON TABLE public.messages IS 'Chat messages within conversations (public schema for Supabase client)';

-- Note: Clerk table comments are managed by Clerk

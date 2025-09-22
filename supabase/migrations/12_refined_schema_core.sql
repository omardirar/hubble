-- =============================================================================
-- Refined Schema: Core Business Entities
-- =============================================================================
-- This migration creates the core schema with improved table names and organization
-- for business entities like organizations, provisioning workflows, and quotas.

-- Create core schema
CREATE SCHEMA IF NOT EXISTS core;

-- =============================================================================
-- Core Types
-- =============================================================================

-- Organization status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status_t' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'core')) THEN
    CREATE TYPE core.organization_status_t AS ENUM ('provisioning','ready','suspended','failed');
  END IF;
END$$;

-- Provisioning workflow status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provisioning_status_t' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'core')) THEN
    CREATE TYPE core.provisioning_status_t AS ENUM ('pending','running','ready','failed');
  END IF;
END$$;

-- =============================================================================
-- Core Tables
-- =============================================================================

-- Organizations table (renamed from tenants)
CREATE TABLE IF NOT EXISTS core.organizations (
  org_id     text primary key,
  slug       text unique not null,
  status     core.organization_status_t not null default 'provisioning',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug_lower ON core.organizations (lower(slug));
CREATE INDEX IF NOT EXISTS idx_organizations_status ON core.organizations (status);

-- Slug update prevention trigger
CREATE OR REPLACE FUNCTION core.block_slug_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'slug updates are not allowed; create a new organization instead';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION core.block_slug_update() SET search_path = pg_catalog, core;

DROP TRIGGER IF EXISTS trg_organizations_block_slug ON core.organizations;
CREATE TRIGGER trg_organizations_block_slug
BEFORE UPDATE ON core.organizations
FOR EACH ROW EXECUTE FUNCTION core.block_slug_update();

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_organizations_set_updated_at ON core.organizations;
CREATE TRIGGER trg_organizations_set_updated_at
BEFORE UPDATE ON core.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Provisioning workflows table (renamed from provisioning_runs)
CREATE TABLE IF NOT EXISTS core.provisioning_workflows (
  correlation_id          text primary key default (extensions.gen_random_uuid())::text,
  org_id                  text not null references core.organizations(org_id) on delete cascade,
  status                  core.provisioning_status_t not null default 'pending',
  md_db_name              text,
  md_sa_username          text,
  fivetran_destination_id text,
  metadata                jsonb not null default '{}'::jsonb,
  error_message           text,
  started_at              timestamptz not null default now(),
  finished_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_provisioning_workflows_org_created ON core.provisioning_workflows (org_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_provisioning_workflows_status ON core.provisioning_workflows (status);
CREATE INDEX IF NOT EXISTS idx_provisioning_workflows_org_active ON core.provisioning_workflows (org_id, started_at desc)
  WHERE status IN ('pending','running');

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_provisioning_workflows_set_updated_at ON core.provisioning_workflows;
CREATE TRIGGER trg_provisioning_workflows_set_updated_at
BEFORE UPDATE ON core.provisioning_workflows
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Organization quotas table (renamed from tenant_quotas)
CREATE TABLE IF NOT EXISTS core.organization_quotas (
  org_id               text primary key references core.organizations(org_id) on delete cascade,
  max_connectors       integer,
  max_storage_gb_est   numeric,
  max_daily_rows       bigint,
  max_query_runtime_ms integer,
  updated_at           timestamptz not null default now()
);

-- Ensure quotas are positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_organization_quotas_positive'
    AND conrelid = 'core.organization_quotas'::regclass
  ) THEN
    ALTER TABLE core.organization_quotas
      ADD CONSTRAINT chk_organization_quotas_positive CHECK (
        (max_connectors IS NULL OR max_connectors > 0) AND
        (max_storage_gb_est IS NULL OR max_storage_gb_est > 0) AND
        (max_daily_rows IS NULL OR max_daily_rows > 0)
      );
  END IF;
END$$;

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_organization_quotas_set_updated_at ON core.organization_quotas;
CREATE TRIGGER trg_organization_quotas_set_updated_at
BEFORE UPDATE ON core.organization_quotas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.provisioning_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.organization_quotas ENABLE ROW LEVEL SECURITY;

-- Organizations policies
DROP POLICY IF EXISTS organizations_select_org ON core.organizations;
CREATE POLICY organizations_select_org
  ON core.organizations FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS organizations_insert_org ON core.organizations;
CREATE POLICY organizations_insert_org
  ON core.organizations FOR INSERT
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS organizations_update_org ON core.organizations;
CREATE POLICY organizations_update_org
  ON core.organizations FOR UPDATE
  USING (org_id = (SELECT public.jwt_claim('org_id')))
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

-- Provisioning workflows policies
DROP POLICY IF EXISTS provisioning_workflows_select_org ON core.provisioning_workflows;
CREATE POLICY provisioning_workflows_select_org
  ON core.provisioning_workflows FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS provisioning_workflows_insert_org ON core.provisioning_workflows;
CREATE POLICY provisioning_workflows_insert_org
  ON core.provisioning_workflows FOR INSERT
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS provisioning_workflows_update_org ON core.provisioning_workflows;
CREATE POLICY provisioning_workflows_update_org
  ON core.provisioning_workflows FOR UPDATE
  USING (org_id = (SELECT public.jwt_claim('org_id')))
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS provisioning_workflows_delete_org ON core.provisioning_workflows;
CREATE POLICY provisioning_workflows_delete_org
  ON core.provisioning_workflows FOR DELETE
  USING (org_id = (SELECT public.jwt_claim('org_id')));

-- Organization quotas policies
DROP POLICY IF EXISTS organization_quotas_select_org ON core.organization_quotas;
CREATE POLICY organization_quotas_select_org
  ON core.organization_quotas FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

-- =============================================================================
-- Views
-- =============================================================================

-- Organizations view
DROP VIEW IF EXISTS core.v_organizations;
CREATE VIEW core.v_organizations
  WITH (security_invoker = true, security_barrier = true) AS
SELECT org_id, slug, status, created_at, updated_at
FROM core.organizations;

-- =============================================================================
-- Permissions
-- =============================================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA core TO authenticated;
GRANT SELECT ON TABLE core.organizations TO authenticated;
GRANT INSERT ON TABLE core.organizations TO authenticated;
GRANT UPDATE ON TABLE core.organizations TO authenticated;
GRANT SELECT ON TABLE core.provisioning_workflows TO authenticated;
GRANT INSERT ON TABLE core.provisioning_workflows TO authenticated;
GRANT UPDATE ON TABLE core.provisioning_workflows TO authenticated;
GRANT DELETE ON TABLE core.provisioning_workflows TO authenticated;
GRANT SELECT ON TABLE core.organization_quotas TO authenticated;
GRANT SELECT ON TABLE core.v_organizations TO authenticated;

-- Grant permissions to service_role
GRANT USAGE ON SCHEMA core TO service_role;
GRANT ALL ON TABLE core.organizations TO service_role;
GRANT ALL ON TABLE core.provisioning_workflows TO service_role;
GRANT ALL ON TABLE core.organization_quotas TO service_role;
GRANT SELECT ON TABLE core.v_organizations TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON SCHEMA core IS 'Core business entities including organizations, provisioning workflows, and quotas';
COMMENT ON TABLE core.organizations IS 'Organization registry keyed by org_id; 1:1 with auth org';
COMMENT ON TABLE core.provisioning_workflows IS 'Tracks per-enable provisioning attempts per org (correlation_id/status/metadata)';
COMMENT ON TABLE core.organization_quotas IS 'Usage quotas and limits per organization';

COMMENT ON COLUMN core.organizations.org_id IS 'Clerk organization id (e.g., org_...)';
COMMENT ON COLUMN core.organizations.slug IS 'URL-safe organization slug; unique per org';
COMMENT ON COLUMN core.organizations.status IS 'Organization lifecycle status';

COMMENT ON COLUMN core.provisioning_workflows.correlation_id IS 'Workflow correlation id (primary key)';
COMMENT ON COLUMN core.provisioning_workflows.org_id IS 'Owning organization id';
COMMENT ON COLUMN core.provisioning_workflows.status IS 'Workflow status (enum provisioning_status_t)';
COMMENT ON COLUMN core.provisioning_workflows.md_db_name IS 'Target MotherDuck database name';
COMMENT ON COLUMN core.provisioning_workflows.md_sa_username IS 'MotherDuck service account username';
COMMENT ON COLUMN core.provisioning_workflows.fivetran_destination_id IS 'Fivetran destination id for organization';
COMMENT ON COLUMN core.provisioning_workflows.metadata IS 'Additional workflow metadata (JSON)';
COMMENT ON COLUMN core.provisioning_workflows.error_message IS 'Error message if workflow failed';
COMMENT ON COLUMN core.provisioning_workflows.started_at IS 'Workflow start time';
COMMENT ON COLUMN core.provisioning_workflows.finished_at IS 'Workflow finish time (if set)';

-- =============================================================================
-- Refined Schema: Data Connection Features
-- =============================================================================
-- This migration creates the connect schema with improved table names and organization
-- for data connection features like destinations, connectors, and connector types.

-- Create connect schema
CREATE SCHEMA IF NOT EXISTS connect;

-- =============================================================================
-- Connect Types
-- =============================================================================

-- Data destination status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'destination_status_t' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'connect')) THEN
    CREATE TYPE connect.destination_status_t AS ENUM ('pending','healthy','unhealthy');
  END IF;
END$$;

-- Data connection status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connection_status_t' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'connect')) THEN
    CREATE TYPE connect.connection_status_t AS ENUM ('not_configured','needs_auth','syncing','healthy','paused','error');
  END IF;
END$$;

-- =============================================================================
-- Connect Tables
-- =============================================================================

-- Data destinations table (renamed from tenant_destinations)
CREATE TABLE IF NOT EXISTS connect.data_destinations (
  id                      uuid primary key default extensions.gen_random_uuid(),
  org_id                  text not null references core.organizations(org_id) on delete cascade,
  md_db_name              text not null unique,
  md_token_ref            text not null,
  fivetran_destination_id text unique,
  status                  connect.destination_status_t not null default 'pending',
  last_event_at           timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  CONSTRAINT uq_data_destinations_per_org UNIQUE (org_id) DEFERRABLE INITIALLY IMMEDIATE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_data_destinations_org ON connect.data_destinations (org_id);
CREATE INDEX IF NOT EXISTS idx_data_destinations_status ON connect.data_destinations (status);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_data_destinations_set_updated_at ON connect.data_destinations;
CREATE TRIGGER trg_data_destinations_set_updated_at
BEFORE UPDATE ON connect.data_destinations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Data connections table (renamed from connections)
CREATE TABLE IF NOT EXISTS connect.data_connections (
  id                      uuid primary key default extensions.gen_random_uuid(),
  org_id                  text not null references core.organizations(org_id) on delete cascade,
  source_type             text not null,
  fivetran_connector_id   text unique,
  schema_name             text,
  status                  connect.connection_status_t not null default 'not_configured',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  CONSTRAINT uq_data_connections_per_source UNIQUE (org_id, source_type) DEFERRABLE INITIALLY IMMEDIATE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_data_connections_org_status ON connect.data_connections (org_id, status);
CREATE INDEX IF NOT EXISTS idx_data_connections_org_created ON connect.data_connections (org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_data_connections_healthy ON connect.data_connections (org_id, updated_at desc)
  WHERE status = 'healthy';

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_data_connections_set_updated_at ON connect.data_connections;
CREATE TRIGGER trg_data_connections_set_updated_at
BEFORE UPDATE ON connect.data_connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Connector types table (renamed from source_types)
CREATE TABLE IF NOT EXISTS connect.connector_types (
  code  text primary key,
  label text not null
);

-- Insert default connector types
INSERT INTO connect.connector_types (code, label) VALUES
  ('facebook_ads','Meta Ads'),
  ('google_ads','Google Ads'),
  ('tiktok_ads','TikTok Ads'),
  ('linkedin_ads','LinkedIn Ads')
ON CONFLICT (code) DO NOTHING;

-- Create index for search
CREATE INDEX IF NOT EXISTS idx_connector_types_label ON connect.connector_types USING gin (label extensions.gin_trgm_ops);

-- Add foreign key constraint
ALTER TABLE connect.data_connections
  ADD CONSTRAINT fk_data_connections_source_type
  FOREIGN KEY (source_type) REFERENCES connect.connector_types(code) NOT VALID;

-- Validate foreign key constraint
ALTER TABLE connect.data_connections VALIDATE CONSTRAINT fk_data_connections_source_type;

-- =============================================================================
-- Constraints
-- =============================================================================

-- Data destinations constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_data_destinations_md_db_name_format'
    AND conrelid = 'connect.data_destinations'::regclass
  ) THEN
    ALTER TABLE connect.data_destinations
      ADD CONSTRAINT chk_data_destinations_md_db_name_format
      CHECK (md_db_name ~ '^md_[a-z0-9_-]+$');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_data_destinations_md_token_ref_nonempty'
    AND conrelid = 'connect.data_destinations'::regclass
  ) THEN
    ALTER TABLE connect.data_destinations
      ADD CONSTRAINT chk_data_destinations_md_token_ref_nonempty
      CHECK (length(md_token_ref) > 0);
  END IF;
END$$;

-- Data connections constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_data_connections_schema_name_nonempty'
    AND conrelid = 'connect.data_connections'::regclass
  ) THEN
    ALTER TABLE connect.data_connections
      ADD CONSTRAINT chk_data_connections_schema_name_nonempty
      CHECK (schema_name IS NULL OR length(schema_name) > 0);
  END IF;
END$$;

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE connect.data_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE connect.data_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connect.connector_types ENABLE ROW LEVEL SECURITY;

-- Data destinations policies
DROP POLICY IF EXISTS data_destinations_select_org ON connect.data_destinations;
CREATE POLICY data_destinations_select_org
  ON connect.data_destinations FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS data_destinations_insert_service_role ON connect.data_destinations;
CREATE POLICY data_destinations_insert_service_role
  ON connect.data_destinations FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS data_destinations_update_service_role ON connect.data_destinations;
CREATE POLICY data_destinations_update_service_role
  ON connect.data_destinations FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS data_destinations_delete_service_role ON connect.data_destinations;
CREATE POLICY data_destinations_delete_service_role
  ON connect.data_destinations FOR DELETE
  TO service_role
  USING (true);

-- Data connections policies
DROP POLICY IF EXISTS data_connections_select_org ON connect.data_connections;
CREATE POLICY data_connections_select_org
  ON connect.data_connections FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

-- Connector types policies (read-only for all authenticated users)
DROP POLICY IF EXISTS connector_types_read_all ON connect.connector_types;
CREATE POLICY connector_types_read_all
  ON connect.connector_types FOR SELECT
  USING (true);

-- =============================================================================
-- Views
-- =============================================================================

-- Data destinations view
DROP VIEW IF EXISTS connect.v_data_destinations;
CREATE VIEW connect.v_data_destinations
  WITH (security_invoker = true, security_barrier = true) AS
SELECT id, org_id, md_db_name, status, last_event_at, created_at, updated_at
FROM connect.data_destinations;

-- Data connections view
DROP VIEW IF EXISTS connect.v_data_connections;
CREATE VIEW connect.v_data_connections
  WITH (security_invoker = true, security_barrier = true) AS
SELECT id, org_id, source_type, schema_name, status, created_at, updated_at
FROM connect.data_connections;

-- =============================================================================
-- Permissions
-- =============================================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA connect TO authenticated;
GRANT SELECT ON TABLE connect.data_destinations TO authenticated;
GRANT SELECT ON TABLE connect.data_connections TO authenticated;
GRANT SELECT ON TABLE connect.connector_types TO authenticated;
GRANT SELECT ON TABLE connect.v_data_destinations TO authenticated;
GRANT SELECT ON TABLE connect.v_data_connections TO authenticated;

-- Grant permissions to service_role
GRANT USAGE ON SCHEMA connect TO service_role;
GRANT ALL ON TABLE connect.data_destinations TO service_role;
GRANT ALL ON TABLE connect.data_connections TO service_role;
GRANT ALL ON TABLE connect.connector_types TO service_role;
GRANT SELECT ON TABLE connect.v_data_destinations TO service_role;
GRANT SELECT ON TABLE connect.v_data_connections TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON SCHEMA connect IS 'Data connection and integration features including destinations, connectors, and types';
COMMENT ON TABLE connect.data_destinations IS 'Per-organization MotherDuck DB + Fivetran destination metadata';
COMMENT ON TABLE connect.data_connections IS 'Per-organization Fivetran connectors (one per source_type)';
COMMENT ON TABLE connect.connector_types IS 'Allowed connector types; referenced by data_connections.source_type';

COMMENT ON COLUMN connect.data_destinations.org_id IS 'Owning organization id';
COMMENT ON COLUMN connect.data_destinations.md_db_name IS 'MotherDuck database name for this organization';
COMMENT ON COLUMN connect.data_destinations.md_token_ref IS 'Vault secret reference key (not plaintext)';
COMMENT ON COLUMN connect.data_destinations.fivetran_destination_id IS 'Fivetran destination id';
COMMENT ON COLUMN connect.data_destinations.status IS 'Destination health status';
COMMENT ON COLUMN connect.data_destinations.last_event_at IS 'Last event timestamp for this destination';

COMMENT ON COLUMN connect.data_connections.org_id IS 'Owning organization id';
COMMENT ON COLUMN connect.data_connections.source_type IS 'Connector source type code (FK to connector_types.code)';
COMMENT ON COLUMN connect.data_connections.fivetran_connector_id IS 'Fivetran connector id';
COMMENT ON COLUMN connect.data_connections.schema_name IS 'Schema name used for connector ingestion';
COMMENT ON COLUMN connect.data_connections.status IS 'Connector status';

COMMENT ON COLUMN connect.connector_types.code IS 'Connector source type code';
COMMENT ON COLUMN connect.connector_types.label IS 'Human-readable label for connector type';

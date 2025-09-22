-- =============================================================================
-- Consolidated Database Permissions
-- =============================================================================
-- This file contains all database permissions and grants for the Hubble application.

-- =============================================================================
-- Schema Permissions
-- =============================================================================

-- Grant usage on schemas to authenticated users
DO $$ BEGIN
  GRANT USAGE ON SCHEMA core TO authenticated;
  GRANT USAGE ON SCHEMA connect TO authenticated;
  GRANT USAGE ON SCHEMA system TO authenticated;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Grant usage on schemas to service_role
DO $$ BEGIN
  GRANT USAGE ON SCHEMA core TO service_role;
  GRANT USAGE ON SCHEMA connect TO service_role;
  GRANT USAGE ON SCHEMA system TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- Core Table Permissions
-- =============================================================================

-- Organizations permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE core.organizations TO authenticated;
  GRANT INSERT ON TABLE core.organizations TO authenticated;
  GRANT UPDATE ON TABLE core.organizations TO authenticated;
  GRANT ALL ON TABLE core.organizations TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Provisioning workflows permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE core.provisioning_workflows TO authenticated;
  GRANT INSERT ON TABLE core.provisioning_workflows TO authenticated;
  GRANT UPDATE ON TABLE core.provisioning_workflows TO authenticated;
  GRANT DELETE ON TABLE core.provisioning_workflows TO authenticated;
  GRANT ALL ON TABLE core.provisioning_workflows TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Organization quotas permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE core.organization_quotas TO authenticated;
  GRANT ALL ON TABLE core.organization_quotas TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Core views permissions (no views defined in current schema)

-- =============================================================================
-- Connect Table Permissions
-- =============================================================================

-- Data destinations permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE connect.data_destinations TO authenticated;
  GRANT ALL ON TABLE connect.data_destinations TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Data connections permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE connect.data_connections TO authenticated;
  GRANT INSERT ON TABLE connect.data_connections TO authenticated;
  GRANT UPDATE ON TABLE connect.data_connections TO authenticated;
  GRANT DELETE ON TABLE connect.data_connections TO authenticated;
  GRANT ALL ON TABLE connect.data_connections TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Connector types permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE connect.connector_types TO authenticated;
  GRANT ALL ON TABLE connect.connector_types TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Connect views permissions (no views defined in current schema)

-- =============================================================================
-- System Table Permissions
-- =============================================================================

-- Audit events permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE system.audit_events TO authenticated;
  GRANT INSERT ON TABLE system.audit_events TO authenticated;
  GRANT ALL ON TABLE system.audit_events TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Secrets permissions (service role only)
DO $$ BEGIN
  GRANT ALL ON TABLE system.secrets TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Idempotency keys permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE system.idempotency_keys TO authenticated;
  GRANT ALL ON TABLE system.idempotency_keys TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Rate limits permissions (service role only)
DO $$ BEGIN
  GRANT ALL ON TABLE system.rate_limits TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- Note: Views inherit permissions from underlying tables
-- =============================================================================
-- Views automatically inherit permissions from their underlying tables.
-- No need to grant permissions on views directly.

-- =============================================================================
-- Chat Table Permissions
-- =============================================================================

-- Conversations permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE public.conversations TO authenticated;
  GRANT INSERT ON TABLE public.conversations TO authenticated;
  GRANT UPDATE ON TABLE public.conversations TO authenticated;
  GRANT DELETE ON TABLE public.conversations TO authenticated;
  GRANT ALL ON TABLE public.conversations TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Messages permissions
DO $$ BEGIN
  GRANT SELECT ON TABLE public.messages TO authenticated;
  GRANT INSERT ON TABLE public.messages TO authenticated;
  GRANT UPDATE ON TABLE public.messages TO authenticated;
  GRANT DELETE ON TABLE public.messages TO authenticated;
  GRANT ALL ON TABLE public.messages TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- Clerk Table Permissions
-- =============================================================================

-- Clerk users permissions (read-only for authenticated users)
-- Note: Clerk tables are managed by Clerk, permissions are set automatically
-- These grants are included for completeness but may not be necessary

-- Clerk dev permissions (read-only for authenticated users)
-- Note: Clerk dev tables are managed by Clerk, permissions are set automatically
-- These grants are included for completeness but may not be necessary

-- =============================================================================
-- Function Permissions
-- =============================================================================

-- Core functions
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.jwt_claim(text) TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.block_update_delete() TO service_role;
  GRANT EXECUTE ON FUNCTION core.block_slug_update() TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- System functions
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION system.set_audit_events_created_on() TO service_role;
  GRANT EXECUTE ON FUNCTION system.set_audit_event_seq() TO service_role;
  GRANT EXECUTE ON FUNCTION system.set_secret(TEXT, TEXT, TEXT) TO service_role;
  GRANT EXECUTE ON FUNCTION system.get_secret(TEXT, TEXT) TO service_role;
  GRANT EXECUTE ON FUNCTION system.has_secret(TEXT, TEXT) TO service_role;
  GRANT EXECUTE ON FUNCTION system.delete_secret(TEXT, TEXT) TO service_role;
  GRANT EXECUTE ON FUNCTION system.get_md_sa_token(TEXT) TO service_role;
  GRANT EXECUTE ON FUNCTION system.set_md_sa_token(TEXT, TEXT) TO service_role;
  GRANT EXECUTE ON FUNCTION system.rate_limit_check(text, text, interval, int) TO service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Clerk functions
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.ensure_tenant_exists(text) TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.get_org_from_clerk_mirror(text) TO authenticated, service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Chat functions
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.rpc_append_message(uuid, text, jsonb, text) TO authenticated, service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- Sequence Permissions
-- =============================================================================

-- Grant permissions on sequences
DO $$ BEGIN
  GRANT USAGE, SELECT ON SEQUENCE system.audit_events_id_seq TO authenticated, service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- Type Permissions
-- =============================================================================

-- Grant usage on custom types
DO $$ BEGIN
  GRANT USAGE ON TYPE core.organization_status_t TO authenticated, service_role;
  GRANT USAGE ON TYPE core.provisioning_status_t TO authenticated, service_role;
  GRANT USAGE ON TYPE connect.destination_status_t TO authenticated, service_role;
  GRANT USAGE ON TYPE connect.connection_status_t TO authenticated, service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

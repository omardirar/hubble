-- =============================================================================
-- Fivetran Log Views
-- =============================================================================
-- These views provide access to Fivetran log data for monitoring connection
-- status, sync health, and usage metrics. Views are created in the connect
-- schema and filtered by organization for security.
--
-- Prerequisites:
-- - Fivetran log connector must be configured to sync to fivetran_log schema
-- - Destination must be the organization's MotherDuck database
--
-- IMPORTANT: How org_id Filtering Works
-- ========================================
-- Fivetran log tables (connection, log, destination, etc.) do NOT contain org_id.
-- Security is enforced through RLS on the underlying tables:
--
-- 1. Views join data_connections (has org_id and RLS enabled) with fivetran_log
-- 2. Views use security_invoker=true (execute with user's permissions)
-- 3. RLS on data_connections filters by: org_id = jwt_claim('org_id')
-- 4. Views automatically inherit RLS from data_connections
--
-- This is best practice per Supabase docs:
-- - Views cannot have RLS policies directly
-- - Views inherit RLS from underlying tables
-- - security_invoker=true ensures user's permissions are checked
-- - Separation of concerns: view = data structure, RLS = security
--
-- Benefits:
-- - Better performance (RLS policies can use indexes)
-- - Cleaner code (no WHERE clauses in views)
-- - More flexible for different user roles
--
-- Views will return rows from data_connections with NULL Fivetran columns if:
-- 1. fivetran_log schema doesn't exist (connector not configured)
-- 2. fivetran_connector_id in data_connections doesn't match any connection_id
-- 3. Fivetran log connector hasn't synced yet
--
-- The application handles this gracefully by checking if fivetran_health is null
-- =============================================================================

-- =============================================================================
-- Connection Overview View
-- =============================================================================
-- Simple view with essential Fivetran connection info
-- All data comes from fivetran_log.connection table (synced by Fivetran)

CREATE OR REPLACE VIEW connect.v_fivetran_connection_overview
WITH (security_invoker = true) AS
SELECT
  -- Local identifiers
  dc.id as local_connection_id,
  dc.org_id,
  dc.source_type,
  dc.schema_name,

  -- Fivetran identifiers
  dc.fivetran_connector_id,
  fc.connection_name,

  -- Connector type
  ct.official_connector_name,
  ct.type as connector_type,

  -- Status and timing
  CASE
    WHEN fc._fivetran_deleted = true THEN 'deleted'
    WHEN fc.paused = true THEN 'paused'
    WHEN fc.connection_id IS NULL THEN 'not_configured'
    ELSE 'active'
  END as status,

  fc.paused,
  fc.sync_frequency,
  last_sync.last_successful_sync_at,

  -- Additional metadata
  fc.deployment_type,
  d.name as destination_name,
  d.region as destination_region

FROM connect.data_connections dc
LEFT JOIN fivetran_log.connection fc
  ON dc.fivetran_connector_id = fc.connection_id
LEFT JOIN fivetran_log.connector_type ct
  ON fc.connector_type_id = ct.id
LEFT JOIN fivetran_log.destination d
  ON fc.destination_id = d.id
LEFT JOIN LATERAL (
  SELECT MAX(l.time_stamp) as last_successful_sync_at
  FROM fivetran_log.log l
  WHERE l.connection_id = dc.fivetran_connector_id
    AND l.message_event = 'sync_end'
    AND l.message_data = '{"status":"SUCCESSFUL"}'
) last_sync ON true;

COMMENT ON VIEW connect.v_fivetran_connection_overview IS
'Fivetran connection overview with basic info: connector, status, last successful sync, and identifiers';


-- =============================================================================
-- Public Schema Compatibility View
-- =============================================================================
-- Mirror view in public schema for Supabase client compatibility

CREATE OR REPLACE VIEW public.v_fivetran_connection_overview
WITH (security_invoker = true) AS
SELECT * FROM connect.v_fivetran_connection_overview;

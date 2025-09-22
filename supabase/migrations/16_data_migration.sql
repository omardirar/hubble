-- =============================================================================
-- Data Migration: Move data from old tables to new refined schema
-- =============================================================================
-- This migration moves data from the old public schema tables to the new
-- refined schema tables with proper organization and naming.

-- =============================================================================
-- Migrate Organizations Data
-- =============================================================================

-- Migrate from public.tenants to core.organizations (if source table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    INSERT INTO core.organizations (org_id, slug, status, created_at, updated_at)
    SELECT
      org_id,
      slug,
      status::core.organization_status_t,
      created_at,
      updated_at
    FROM public.tenants
    WHERE NOT EXISTS (
      SELECT 1 FROM core.organizations c
      WHERE c.org_id = public.tenants.org_id
    )
    ON CONFLICT (org_id) DO UPDATE SET
      slug = EXCLUDED.slug,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;
  END IF;
END$$;

-- Migrate from public.tenant_provisioning to core.organizations (if different)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_provisioning') THEN
    INSERT INTO core.organizations (org_id, slug, status, created_at, updated_at)
    SELECT
      org_id,
      slug,
      CASE
        WHEN status = 'running' THEN 'provisioning'::core.organization_status_t
        ELSE status::core.organization_status_t
      END,
      created_at,
      updated_at
    FROM public.tenant_provisioning
    WHERE NOT EXISTS (
      SELECT 1 FROM core.organizations c
      WHERE c.org_id = public.tenant_provisioning.org_id
    )
    ON CONFLICT (org_id) DO UPDATE SET
      slug = EXCLUDED.slug,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;
  END IF;
END$$;

-- =============================================================================
-- Migrate Provisioning Workflows Data
-- =============================================================================

-- Migrate from public.provisioning_runs to core.provisioning_workflows
INSERT INTO core.provisioning_workflows (
  correlation_id,
  org_id,
  status,
  md_db_name,
  md_sa_username,
  fivetran_destination_id,
  metadata,
  error_message,
  started_at,
  finished_at,
  created_at,
  updated_at
)
SELECT
  correlation_id,
  org_id,
  status::core.provisioning_status_t,
  md_db_name,
  md_sa_username,
  fivetran_destination_id,
  metadata,
  error_message,
  started_at,
  finished_at,
  created_at,
  updated_at
FROM public.provisioning_runs
WHERE NOT EXISTS (
  SELECT 1 FROM core.provisioning_workflows c
  WHERE c.correlation_id = public.provisioning_runs.correlation_id
)
ON CONFLICT (correlation_id) DO UPDATE SET
  status = EXCLUDED.status,
  md_db_name = EXCLUDED.md_db_name,
  md_sa_username = EXCLUDED.md_sa_username,
  fivetran_destination_id = EXCLUDED.fivetran_destination_id,
  metadata = EXCLUDED.metadata,
  error_message = EXCLUDED.error_message,
  started_at = EXCLUDED.started_at,
  finished_at = EXCLUDED.finished_at,
  updated_at = EXCLUDED.updated_at;

-- =============================================================================
-- Migrate Data Destinations
-- =============================================================================

-- Migrate from public.tenant_destinations to connect.data_destinations
INSERT INTO connect.data_destinations (
  id,
  org_id,
  md_db_name,
  md_token_ref,
  fivetran_destination_id,
  status,
  last_event_at,
  created_at,
  updated_at
)
SELECT
  id,
  org_id,
  md_db_name,
  md_token_ref,
  fivetran_destination_id,
  status::connect.destination_status_t,
  last_event_at,
  created_at,
  updated_at
FROM public.tenant_destinations
WHERE NOT EXISTS (
  SELECT 1 FROM connect.data_destinations c
  WHERE c.id = public.tenant_destinations.id
)
ON CONFLICT (id) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  md_db_name = EXCLUDED.md_db_name,
  md_token_ref = EXCLUDED.md_token_ref,
  fivetran_destination_id = EXCLUDED.fivetran_destination_id,
  status = EXCLUDED.status,
  last_event_at = EXCLUDED.last_event_at,
  updated_at = EXCLUDED.updated_at;

-- =============================================================================
-- Migrate Data Connections
-- =============================================================================

-- Migrate from public.connections to connect.data_connections
INSERT INTO connect.data_connections (
  id,
  org_id,
  source_type,
  fivetran_connector_id,
  schema_name,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  org_id,
  source_type,
  fivetran_connector_id,
  schema_name,
  status::connect.connection_status_t,
  created_at,
  updated_at
FROM public.connections
WHERE NOT EXISTS (
  SELECT 1 FROM connect.data_connections c
  WHERE c.id = public.connections.id
)
ON CONFLICT (id) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  source_type = EXCLUDED.source_type,
  fivetran_connector_id = EXCLUDED.fivetran_connector_id,
  schema_name = EXCLUDED.schema_name,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

-- =============================================================================
-- Migrate Connector Types
-- =============================================================================

-- Migrate from public.source_types to connect.connector_types
INSERT INTO connect.connector_types (code, label)
SELECT code, label
FROM public.source_types
WHERE NOT EXISTS (
  SELECT 1 FROM connect.connector_types c
  WHERE c.code = public.source_types.code
)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- Migrate Audit Events
-- =============================================================================

-- Migrate from public.events to system.audit_events
INSERT INTO system.audit_events (
  id,
  event_seq,
  org_id,
  provider,
  type,
  correlation_id,
  payload,
  created_at,
  created_on
)
SELECT
  id,
  event_seq,
  org_id,
  provider,
  type,
  correlation_id,
  payload,
  created_at,
  created_on
FROM public.events
WHERE NOT EXISTS (
  SELECT 1 FROM system.audit_events s
  WHERE s.id = public.events.id
)
ON CONFLICT (id) DO UPDATE SET
  event_seq = EXCLUDED.event_seq,
  org_id = EXCLUDED.org_id,
  provider = EXCLUDED.provider,
  type = EXCLUDED.type,
  correlation_id = EXCLUDED.correlation_id,
  payload = EXCLUDED.payload,
  created_at = EXCLUDED.created_at,
  created_on = EXCLUDED.created_on;

-- =============================================================================
-- Migrate Secrets
-- =============================================================================

-- Migrate from public.service_secrets to system.secrets
INSERT INTO system.secrets (
  id,
  org_id,
  secret_name,
  secret_value,
  created_at,
  updated_at
)
SELECT
  id,
  org_id,
  secret_name,
  secret_value,
  created_at,
  updated_at
FROM public.service_secrets
WHERE NOT EXISTS (
  SELECT 1 FROM system.secrets s
  WHERE s.id = public.service_secrets.id
)
ON CONFLICT (id) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  secret_name = EXCLUDED.secret_name,
  secret_value = EXCLUDED.secret_value,
  updated_at = EXCLUDED.updated_at;

-- =============================================================================
-- Migrate Idempotency Keys
-- =============================================================================

-- Migrate from public.idempotency_keys to system.idempotency_keys
INSERT INTO system.idempotency_keys (
  key,
  org_id,
  first_seen_at,
  last_result
)
SELECT
  key,
  org_id,
  first_seen_at,
  last_result
FROM public.idempotency_keys
WHERE NOT EXISTS (
  SELECT 1 FROM system.idempotency_keys s
  WHERE s.key = public.idempotency_keys.key
)
ON CONFLICT (key) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  first_seen_at = EXCLUDED.first_seen_at,
  last_result = EXCLUDED.last_result;

-- =============================================================================
-- Migrate Organization Quotas
-- =============================================================================

-- Migrate from public.tenant_quotas to core.organization_quotas
INSERT INTO core.organization_quotas (
  org_id,
  max_connectors,
  max_storage_gb_est,
  max_daily_rows,
  max_query_runtime_ms,
  updated_at
)
SELECT
  org_id,
  max_connectors,
  max_storage_gb_est,
  max_daily_rows,
  max_query_runtime_ms,
  updated_at
FROM public.tenant_quotas
WHERE NOT EXISTS (
  SELECT 1 FROM core.organization_quotas c
  WHERE c.org_id = public.tenant_quotas.org_id
)
ON CONFLICT (org_id) DO UPDATE SET
  max_connectors = EXCLUDED.max_connectors,
  max_storage_gb_est = EXCLUDED.max_storage_gb_est,
  max_daily_rows = EXCLUDED.max_daily_rows,
  max_query_runtime_ms = EXCLUDED.max_query_runtime_ms,
  updated_at = EXCLUDED.updated_at;

-- =============================================================================
-- Migrate Rate Limits
-- =============================================================================

-- Migrate from public.rate_limits to system.rate_limits
INSERT INTO system.rate_limits (
  user_id,
  action,
  window_start,
  count
)
SELECT
  user_id,
  action,
  window_start,
  count
FROM public.rate_limits
WHERE NOT EXISTS (
  SELECT 1 FROM system.rate_limits s
  WHERE s.user_id = public.rate_limits.user_id
    AND s.action = public.rate_limits.action
    AND s.window_start = public.rate_limits.window_start
)
ON CONFLICT (user_id, action, window_start) DO UPDATE SET
  count = EXCLUDED.count;

-- =============================================================================
-- Migrate Chat Data
-- =============================================================================

-- Migrate from public.conversations to chat.conversations
INSERT INTO chat.conversations (
  id,
  org_id,
  owner_user_id,
  title,
  status,
  archived_at,
  model,
  system_prompt,
  created_at,
  updated_at
)
SELECT
  id,
  org_id,
  owner_user_id,
  title,
  status,
  archived_at,
  model,
  system_prompt,
  created_at,
  updated_at
FROM public.conversations
WHERE NOT EXISTS (
  SELECT 1 FROM chat.conversations c
  WHERE c.id = public.conversations.id
)
ON CONFLICT (id) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  owner_user_id = EXCLUDED.owner_user_id,
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  archived_at = EXCLUDED.archived_at,
  model = EXCLUDED.model,
  system_prompt = EXCLUDED.system_prompt,
  updated_at = EXCLUDED.updated_at;

-- Migrate from public.messages to chat.messages
INSERT INTO chat.messages (
  id,
  conversation_id,
  org_id,
  owner_user_id,
  author_user_id,
  role,
  content,
  model,
  tool_name,
  tool_call_id,
  error,
  idempotency_key,
  created_at,
  updated_at
)
SELECT
  id,
  conversation_id,
  org_id,
  owner_user_id,
  author_user_id,
  role,
  COALESCE(content, body, '{}'::jsonb),
  model,
  tool_name,
  tool_call_id,
  error,
  idempotency_key,
  created_at,
  updated_at
FROM public.messages
WHERE NOT EXISTS (
  SELECT 1 FROM chat.messages c
  WHERE c.id = public.messages.id
)
ON CONFLICT (id) DO UPDATE SET
  conversation_id = EXCLUDED.conversation_id,
  org_id = EXCLUDED.org_id,
  owner_user_id = EXCLUDED.owner_user_id,
  author_user_id = EXCLUDED.author_user_id,
  role = EXCLUDED.role,
  content = EXCLUDED.content,
  model = EXCLUDED.model,
  tool_name = EXCLUDED.tool_name,
  tool_call_id = EXCLUDED.tool_call_id,
  error = EXCLUDED.error,
  idempotency_key = EXCLUDED.idempotency_key,
  updated_at = EXCLUDED.updated_at;

-- =============================================================================
-- Update Foreign Key References
-- =============================================================================

-- Update foreign key references in the new tables to point to core.organizations
-- This is already handled by the table definitions, but we need to ensure
-- the data is consistent

-- Update any remaining references in the new schema tables
UPDATE connect.data_destinations
SET org_id = org_id
WHERE org_id IN (SELECT org_id FROM core.organizations);

UPDATE connect.data_connections
SET org_id = org_id
WHERE org_id IN (SELECT org_id FROM core.organizations);

UPDATE system.audit_events
SET org_id = org_id
WHERE org_id IN (SELECT org_id FROM core.organizations);

UPDATE system.idempotency_keys
SET org_id = org_id
WHERE org_id IN (SELECT org_id FROM core.organizations);

UPDATE chat.conversations
SET org_id = org_id
WHERE org_id IN (SELECT org_id FROM core.organizations);

UPDATE chat.messages
SET org_id = org_id
WHERE org_id IN (SELECT org_id FROM core.organizations);

-- =============================================================================
-- Create Public Views for Backward Compatibility
-- =============================================================================

-- Create views in public schema that point to the new tables for backward compatibility
-- This allows existing code to continue working while we update references

-- Organizations view
DROP VIEW IF EXISTS public.v_organizations;
CREATE VIEW public.v_organizations AS
SELECT * FROM core.v_organizations;

-- Data destinations view
DROP VIEW IF EXISTS public.v_tenant_destinations;
CREATE VIEW public.v_tenant_destinations AS
SELECT * FROM connect.v_data_destinations;

-- Data connections view
DROP VIEW IF EXISTS public.v_connections;
CREATE VIEW public.v_connections AS
SELECT * FROM connect.v_data_connections;

-- Conversation summaries view
DROP VIEW IF EXISTS public.conversation_summaries;
CREATE VIEW public.conversation_summaries AS
SELECT * FROM chat.conversation_summaries;

-- =============================================================================
-- Grant Permissions on Public Views
-- =============================================================================

-- Grant permissions to authenticated users
GRANT SELECT ON TABLE public.v_organizations TO authenticated;
GRANT SELECT ON TABLE public.v_tenant_destinations TO authenticated;
GRANT SELECT ON TABLE public.v_connections TO authenticated;
GRANT SELECT ON TABLE public.conversation_summaries TO authenticated;

-- Grant permissions to service_role
GRANT SELECT ON TABLE public.v_organizations TO service_role;
GRANT SELECT ON TABLE public.v_tenant_destinations TO service_role;
GRANT SELECT ON TABLE public.v_connections TO service_role;
GRANT SELECT ON TABLE public.conversation_summaries TO service_role;

-- =============================================================================
-- Update Functions: Update existing functions to use new schema
-- =============================================================================
-- This migration updates existing functions to use the new refined schema tables
-- and provides backward compatibility where needed.

-- =============================================================================
-- Update Core Functions
-- =============================================================================

-- Drop and recreate ensure_tenant_exists function to use core.organizations
DROP FUNCTION IF EXISTS public.ensure_tenant_exists(text);

CREATE FUNCTION public.ensure_tenant_exists(p_org_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rowcount integer;
  v_error_message text;
  v_schema_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM core.organizations WHERE org_id = p_org_id) THEN
    RETURN;
  END IF;

  -- Determine schema based on environment
  if current_setting('app.environment', true) in ('development', 'preview') or
     current_setting('app.environment', true) is null then
    v_schema_name := 'clerk_dev';
  else
    v_schema_name := 'clerk';
  end if;

  BEGIN
    EXECUTE format('
      INSERT INTO core.organizations (org_id, slug, status)
      SELECT
        o.id,
        coalesce(nullif(trim(o.slug), ''''), o.id),
        ''provisioning''::core.organization_status_t
      FROM %I.organizations o
      WHERE o.id = $1
      ON CONFLICT (org_id) DO UPDATE
        SET slug = excluded.slug', v_schema_name)
    USING p_org_id;

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;

    IF v_rowcount = 0 THEN
      RAISE EXCEPTION 'Organization % not found in Clerk', p_org_id USING errcode = 'P0001';
    END IF;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE EXCEPTION 'Clerk FDW not available to sync organization %', p_org_id USING errcode = 'P0001';
    WHEN OTHERS THEN
      v_error_message := SQLERRM;
      RAISE EXCEPTION 'Failed to create organization %: %', p_org_id, v_error_message USING errcode = 'P0002';
  END;
END;
$$;

-- Drop and recreate sync_clerk_organizations_into_tenants function
DROP FUNCTION IF EXISTS public.sync_clerk_organizations_into_tenants();

CREATE FUNCTION public.sync_clerk_organizations_into_tenants()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_schema_name text;
BEGIN
  -- Determine schema based on environment
  if current_setting('app.environment', true) in ('development', 'preview') or
     current_setting('app.environment', true) is null then
    v_schema_name := 'clerk_dev';
  else
    v_schema_name := 'clerk';
  end if;

  -- Insert organizations from the appropriate schema
  EXECUTE format('
    INSERT INTO core.organizations (org_id, slug, status)
    SELECT
      o.id,
      coalesce(nullif(trim(o.slug), ''''), o.id),
      ''provisioning''::core.organization_status_t
    FROM %I.organizations o
    ON CONFLICT (org_id) DO UPDATE
      SET slug = excluded.slug', v_schema_name);
END;
$$;

-- =============================================================================
-- Update Vault Functions for Backward Compatibility
-- =============================================================================

-- Drop and recreate vault_set function to use new system.secrets
DROP FUNCTION IF EXISTS public.vault_set(text, text);

CREATE FUNCTION public.vault_set(p_name text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  org_id TEXT;
  secret_name TEXT;
BEGIN
  -- Extract org_id from the name (format: "md_sa_token:org_id")
  IF p_name LIKE 'md_sa_token:%' THEN
    org_id := split_part(p_name, ':', 2);
    secret_name := 'md_sa_token';
  ELSE
    -- For other secret types, use a default org or extract from context
    -- This maintains backward compatibility
    org_id := 'default';
    secret_name := p_name;
  END IF;

  -- Use the new system secrets table
  PERFORM system.set_secret(org_id, secret_name, p_secret);
END;
$$;

-- Drop and recreate vault_get_secret function to use new system.secrets
DROP FUNCTION IF EXISTS public.vault_get_secret(text);

CREATE FUNCTION public.vault_get_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  org_id TEXT;
  secret_name TEXT;
  secret_value TEXT;
BEGIN
  -- Extract org_id from the name (format: "md_sa_token:org_id")
  IF p_name LIKE 'md_sa_token:%' THEN
    org_id := split_part(p_name, ':', 2);
    secret_name := 'md_sa_token';
  ELSE
    -- For other secret types, use a default org
    org_id := 'default';
    secret_name := p_name;
  END IF;

  -- Use the new system secrets table
  SELECT system.get_secret(org_id, secret_name) INTO secret_value;
  RETURN secret_value;
END;
$$;

-- =============================================================================
-- Create Backward Compatibility Functions
-- =============================================================================

-- Drop and recreate function to get organization data from Clerk mirror (updated)
DROP FUNCTION IF EXISTS public.get_org_from_clerk_mirror(text);

CREATE FUNCTION public.get_org_from_clerk_mirror(p_org_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_data jsonb;
BEGIN
  -- First try to get organization data from Clerk raw_objects table (where the full data is stored)
  SELECT data INTO v_org_data
  FROM clerk.raw_objects
  WHERE object_type = 'organization'
    AND object_id = p_org_id
    AND deleted_at IS NULL;

  -- If not found in raw_objects, check if organization exists in organizations table
  IF v_org_data IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM clerk.organizations
      WHERE organization_id = p_org_id
    ) THEN
      -- Organization exists in organizations table, return a minimal object
      RETURN jsonb_build_object('id', p_org_id, 'exists', true);
    END IF;
  END IF;

  RETURN v_org_data;
END;
$$;

-- Set proper permissions for the helper function
ALTER FUNCTION public.get_org_from_clerk_mirror(text) SET search_path = pg_catalog, public;
GRANT EXECUTE ON FUNCTION public.get_org_from_clerk_mirror(text) TO authenticated;

-- =============================================================================
-- Create New RPC Functions for New Schema
-- =============================================================================

-- Create RPC function for provisioning workflows
CREATE OR REPLACE FUNCTION public.rpc_insert_provisioning_workflow(org_id text)
RETURNS TABLE(correlation_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_correlation_id text;
BEGIN
  -- Ensure organization exists
  PERFORM public.ensure_tenant_exists(org_id);

  -- Insert provisioning workflow
  INSERT INTO core.provisioning_workflows (org_id, status)
  VALUES (org_id, 'pending'::core.provisioning_status_t)
  RETURNING correlation_id INTO v_correlation_id;

  RETURN QUERY SELECT v_correlation_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.rpc_insert_provisioning_workflow(text) TO authenticated, service_role;

-- Create RPC function for updating provisioning workflows
CREATE OR REPLACE FUNCTION public.rpc_update_provisioning_workflow(
  p_correlation_id text,
  p_status text,
  p_md_db_name text DEFAULT NULL,
  p_md_sa_username text DEFAULT NULL,
  p_fivetran_destination_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  updates jsonb := '{}';
BEGIN
  -- Build updates object
  IF p_status IS NOT NULL THEN
    updates := updates || jsonb_build_object('status', p_status::core.provisioning_status_t);
  END IF;

  IF p_md_db_name IS NOT NULL THEN
    updates := updates || jsonb_build_object('md_db_name', p_md_db_name);
  END IF;

  IF p_md_sa_username IS NOT NULL THEN
    updates := updates || jsonb_build_object('md_sa_username', p_md_sa_username);
  END IF;

  IF p_fivetran_destination_id IS NOT NULL THEN
    updates := updates || jsonb_build_object('fivetran_destination_id', p_fivetran_destination_id);
  END IF;

  IF p_metadata IS NOT NULL THEN
    updates := updates || jsonb_build_object('metadata', p_metadata);
  END IF;

  IF p_error_message IS NOT NULL THEN
    updates := updates || jsonb_build_object('error_message', p_error_message);
  END IF;

  -- Add updated_at
  updates := updates || jsonb_build_object('updated_at', now());

  -- Update the workflow
  UPDATE core.provisioning_workflows
  SET
    status = COALESCE((updates->>'status')::core.provisioning_status_t, status),
    md_db_name = COALESCE(updates->>'md_db_name', md_db_name),
    md_sa_username = COALESCE(updates->>'md_sa_username', md_sa_username),
    fivetran_destination_id = COALESCE(updates->>'fivetran_destination_id', fivetran_destination_id),
    metadata = COALESCE((updates->>'metadata')::jsonb, metadata),
    error_message = COALESCE(updates->>'error_message', error_message),
    updated_at = COALESCE((updates->>'updated_at')::timestamptz, updated_at)
  WHERE correlation_id = p_correlation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provisioning workflow % not found', p_correlation_id;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.rpc_update_provisioning_workflow(text, text, text, text, text, jsonb, text) TO authenticated, service_role;

-- Create RPC function for appending audit events
CREATE OR REPLACE FUNCTION public.rpc_append_audit_event(
  p_org_id text,
  p_correlation_id text,
  p_provider text,
  p_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(event_seq bigint, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event_seq bigint;
  v_created_at timestamptz;
BEGIN
  -- Insert audit event
  INSERT INTO system.audit_events (org_id, correlation_id, provider, type, payload)
  VALUES (p_org_id, p_correlation_id, p_provider, p_type, p_payload)
  RETURNING event_seq, created_at INTO v_event_seq, v_created_at;

  RETURN QUERY SELECT v_event_seq, v_created_at;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.rpc_append_audit_event(text, text, text, text, jsonb) TO authenticated, service_role;

-- =============================================================================
-- Update Existing RPC Functions
-- =============================================================================

-- Drop and recreate rpc_append_message to use new chat schema
DROP FUNCTION IF EXISTS public.rpc_append_message(uuid, text, jsonb, text);

CREATE FUNCTION public.rpc_append_message(
  p_conversation_id uuid,
  p_role text,
  p_content jsonb,
  p_idempotency_key text default null
)
RETURNS chat.messages
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_msg chat.messages;
  v_sub text;
  v_org text;
BEGIN
  v_sub := auth.jwt()->>'sub';
  v_org := public.jwt_claim('org_id');

  -- Verify organization exists in Clerk mirror
  IF public.get_org_from_clerk_mirror(v_org) IS NULL THEN
    RAISE EXCEPTION 'Organization % not found in Clerk mirror', v_org USING errcode = '42501';
  END IF;

  -- Optional rate limiting: 120 messages per 5 minutes per user
  PERFORM system.rate_limit_check(v_sub, 'append_message', interval '5 minutes', 120);

  IF p_role NOT IN ('user','assistant','system','tool','function') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role USING errcode = '22023';
  END IF;

  IF pg_column_size(p_content) > 64 * 1024 THEN
    RAISE EXCEPTION 'Content too large' USING errcode = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM chat.conversations c
    WHERE c.id = p_conversation_id
      AND c.owner_user_id = v_sub
      AND c.org_id = v_org
  ) THEN
    RAISE EXCEPTION 'Conversation not found or not owned by caller' USING errcode = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN
    INSERT INTO chat.messages (conversation_id, org_id, owner_user_id, role, content)
    VALUES (p_conversation_id, v_org, v_sub, p_role, p_content)
    RETURNING * INTO v_msg;
  ELSE
    INSERT INTO chat.messages (conversation_id, org_id, owner_user_id, role, content, idempotency_key)
    VALUES (p_conversation_id, v_org, v_sub, p_role, p_content, p_idempotency_key)
    ON CONFLICT (conversation_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
    DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
    RETURNING * INTO v_msg;
  END IF;

  RETURN v_msg;
END;
$$;
ALTER FUNCTION public.rpc_append_message(uuid, text, jsonb, text)
  SET search_path = pg_catalog, public;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION public.ensure_tenant_exists(text) IS 'Ensures organization exists in core.organizations, syncing from Clerk if needed';
COMMENT ON FUNCTION public.sync_clerk_organizations_into_tenants() IS 'Syncs all Clerk organizations into core.organizations';
COMMENT ON FUNCTION public.vault_set(text, text) IS 'Sets a secret in system.secrets (backward compatibility)';
COMMENT ON FUNCTION public.vault_get_secret(text) IS 'Gets a secret from system.secrets (backward compatibility)';
COMMENT ON FUNCTION public.get_org_from_clerk_mirror(text) IS 'Gets organization data from Clerk mirror';
COMMENT ON FUNCTION public.rpc_insert_provisioning_workflow(text) IS 'Inserts a new provisioning workflow';
COMMENT ON FUNCTION public.rpc_update_provisioning_workflow(text, text, text, text, text, jsonb, text) IS 'Updates a provisioning workflow';
COMMENT ON FUNCTION public.rpc_append_audit_event(text, text, text, text, jsonb) IS 'Appends an audit event to system.audit_events';
COMMENT ON FUNCTION public.rpc_append_message(uuid, text, jsonb, text) IS 'Appends a message to a chat conversation';

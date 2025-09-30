-- =============================================================================
-- Consolidated Database Functions and Triggers
-- =============================================================================
-- This file contains all database functions, triggers, and stored procedures
-- for the Hubble application.

-- =============================================================================
-- Utility Functions
-- =============================================================================

-- JWT claim function for Clerk JWT structure
CREATE OR REPLACE FUNCTION public.jwt_claim(claim text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  jwt_payload jsonb;
BEGIN
  -- Get the JWT payload
  jwt_payload := auth.jwt();

  -- Handle different JWT claim patterns
  CASE claim
    WHEN 'sub' THEN
      -- User ID is in the 'sub' claim
      RETURN jwt_payload ->> 'sub';
    WHEN 'org_id' THEN
      -- Try both Clerk JWT structures: direct org_id claim and nested 'o' object
      IF jwt_payload ? 'org_id' THEN
        RETURN jwt_payload ->> 'org_id';
      ELSIF jwt_payload ? 'o' AND jsonb_typeof(jwt_payload -> 'o') = 'object' THEN
        RETURN jwt_payload -> 'o' ->> 'id';
      ELSE
        RETURN NULL;
      END IF;
    WHEN 'org_role' THEN
      -- Try both Clerk JWT structures
      IF jwt_payload ? 'org_role' THEN
        RETURN jwt_payload ->> 'org_role';
      ELSIF jwt_payload ? 'o' AND jsonb_typeof(jwt_payload -> 'o') = 'object' THEN
        RETURN jwt_payload -> 'o' ->> 'rol';
      ELSE
        RETURN NULL;
      END IF;
    WHEN 'org_slug' THEN
      -- Try both Clerk JWT structures
      IF jwt_payload ? 'org_slug' THEN
        RETURN jwt_payload ->> 'org_slug';
      ELSIF jwt_payload ? 'o' AND jsonb_typeof(jwt_payload -> 'o') = 'object' THEN
        RETURN jwt_payload -> 'o' ->> 'slg';
      ELSE
        RETURN NULL;
      END IF;
    ELSE
      -- For any other claim, try direct access
      RETURN jwt_payload ->> claim;
  END CASE;
EXCEPTION
  WHEN OTHERS THEN
    -- Return null for any error
    RETURN NULL;
END;
$$;

-- Set updated_at function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Block update/delete function
CREATE OR REPLACE FUNCTION public.block_update_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Updates and deletes are not allowed on this table';
END;
$$;

-- =============================================================================
-- Core Functions
-- =============================================================================

-- Block slug update function
CREATE OR REPLACE FUNCTION core.block_slug_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = core, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'slug updates are not allowed; create a new organization instead';
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- System Functions
-- =============================================================================

-- Set audit events created_on function
CREATE OR REPLACE FUNCTION system.set_audit_events_created_on()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = system, pg_catalog
AS $$
BEGIN
  NEW.created_on := (coalesce(NEW.created_at, now()) AT TIME ZONE 'UTC')::date;
  RETURN NEW;
END;
$$;

-- Set audit event sequence function
CREATE OR REPLACE FUNCTION system.set_audit_event_seq()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = system, pg_catalog
AS $$
DECLARE
  v_next bigint;
BEGIN
  IF NEW.correlation_id IS NULL THEN
    -- Ensure a correlation is always present to maintain ordering semantics
    NEW.correlation_id := (gen_random_uuid())::text;
  END IF;

  IF NEW.event_seq IS NULL THEN
    SELECT coalesce(MAX(e.event_seq), 0) + 1
      INTO v_next
    FROM system.audit_events e
    WHERE e.correlation_id = NEW.correlation_id;
    NEW.event_seq := v_next;
  END IF;

  RETURN NEW;
END;
$$;

-- Secret management functions
CREATE OR REPLACE FUNCTION system.set_secret(
  p_org_id TEXT,
  p_secret_name TEXT,
  p_secret_value TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, system
AS $$
BEGIN
  -- Validate inputs
  IF p_org_id IS NULL OR p_org_id = '' THEN
    RAISE EXCEPTION 'org_id cannot be null or empty' USING errcode = 'P0001';
  END IF;

  IF p_secret_name IS NULL OR p_secret_name = '' THEN
    RAISE EXCEPTION 'secret_name cannot be null or empty' USING errcode = 'P0001';
  END IF;

  IF p_secret_value IS NULL OR p_secret_value = '' THEN
    RAISE EXCEPTION 'secret_value cannot be null or empty' USING errcode = 'P0001';
  END IF;

  -- Insert or update the secret
  INSERT INTO system.secrets (org_id, secret_name, secret_value)
  VALUES (p_org_id, p_secret_name, p_secret_value)
  ON CONFLICT (org_id, secret_name)
  DO UPDATE SET
    secret_value = EXCLUDED.secret_value,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION system.get_secret(
  p_org_id TEXT,
  p_secret_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, system
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  -- Validate inputs
  IF p_org_id IS NULL OR p_org_id = '' THEN
    RAISE EXCEPTION 'org_id cannot be null or empty' USING errcode = 'P0001';
  END IF;

  IF p_secret_name IS NULL OR p_secret_name = '' THEN
    RAISE EXCEPTION 'secret_name cannot be null or empty' USING errcode = 'P0001';
  END IF;

  -- Get the secret value
  SELECT s.secret_value INTO secret_value
  FROM system.secrets s
  WHERE s.org_id = p_org_id
    AND s.secret_name = p_secret_name;

  -- Return the secret or null if not found
  RETURN secret_value;
END;
$$;

CREATE OR REPLACE FUNCTION system.has_secret(
  p_org_id TEXT,
  p_secret_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, system
AS $$
DECLARE
  secret_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_org_id IS NULL OR p_org_id = '' THEN
    RAISE EXCEPTION 'org_id cannot be null or empty' USING errcode = 'P0001';
  END IF;

  IF p_secret_name IS NULL OR p_secret_name = '' THEN
    RAISE EXCEPTION 'secret_name cannot be null or empty' USING errcode = 'P0001';
  END IF;

  -- Check if secret exists
  SELECT EXISTS(
    SELECT 1
    FROM system.secrets s
    WHERE s.org_id = p_org_id
      AND s.secret_name = p_secret_name
  ) INTO secret_exists;

  RETURN secret_exists;
END;
$$;

CREATE OR REPLACE FUNCTION system.delete_secret(
  p_org_id TEXT,
  p_secret_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, system
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_org_id IS NULL OR p_org_id = '' THEN
    RAISE EXCEPTION 'org_id cannot be null or empty' USING errcode = 'P0001';
  END IF;

  IF p_secret_name IS NULL OR p_secret_name = '' THEN
    RAISE EXCEPTION 'secret_name cannot be null or empty' USING errcode = 'P0001';
  END IF;

  -- Delete the secret
  DELETE FROM system.secrets
  WHERE org_id = p_org_id
    AND secret_name = p_secret_name;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- Convenience functions for MotherDuck SA tokens
CREATE OR REPLACE FUNCTION system.get_md_sa_token(p_org_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, system
AS $$
BEGIN
  RETURN system.get_secret(p_org_id, 'md_sa_token');
END;
$$;

CREATE OR REPLACE FUNCTION system.set_md_sa_token(p_org_id TEXT, p_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, system
AS $$
BEGIN
  PERFORM system.set_secret(p_org_id, 'md_sa_token', p_token);
END;
$$;

-- Rate limiting function
CREATE OR REPLACE FUNCTION system.rate_limit_check(p_user_id text, p_action text, p_window interval, p_limit int)
RETURNS void
LANGUAGE plpgsql
SET search_path = system, pg_catalog
AS $$
DECLARE
  v_start timestamptz := date_trunc('minute', now());
  v_window_start timestamptz := v_start - p_window + interval '1 minute';
  v_cnt int;
BEGIN
  -- roll current window
  INSERT INTO system.rate_limits(user_id, action, window_start, count)
  VALUES (p_user_id, p_action, v_start, 0)
  ON CONFLICT (user_id, action, window_start) DO NOTHING;

  -- aggregate counts over window
  SELECT coalesce(sum(count), 0)
    INTO v_cnt
  FROM system.rate_limits
  WHERE user_id = p_user_id
    AND action  = p_action
    AND window_start >= v_window_start;

  IF v_cnt >= p_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded for %', p_action USING errcode = 'P0001';
  END IF;

  -- increment current minute bucket
  UPDATE system.rate_limits
     SET count = count + 1
   WHERE user_id = p_user_id
     AND action  = p_action
     AND window_start = v_start;
END;
$$;

-- =============================================================================
-- Clerk Functions
-- =============================================================================

-- Ensure tenant exists function
CREATE OR REPLACE FUNCTION public.ensure_tenant_exists(p_org_id text)
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
      RAISE EXCEPTION 'Organization not found in Clerk' USING errcode = 'P0001';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
      RAISE EXCEPTION 'Failed to create organization: %', v_error_message USING errcode = 'P0002';
  END;
END;
$$;

-- Get organization from Clerk mirror function
CREATE OR REPLACE FUNCTION public.get_org_from_clerk_mirror(p_org_id text)
RETURNS TABLE(org_id text, slug text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
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

  RETURN QUERY EXECUTE format('
    SELECT o.id, o.slug, o.name
    FROM %I.organizations o
    WHERE o.id = $1', v_schema_name)
  USING p_org_id;
END;
$$;

-- =============================================================================
-- Chat Functions
-- =============================================================================

-- Append message function
CREATE OR REPLACE FUNCTION public.rpc_append_message(
  p_conversation_id uuid,
  p_role text,
  p_content jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(id uuid, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org_id text;
  v_owner_user_id text;
  v_message_id uuid;
  v_created_at timestamptz;
BEGIN
  -- Get conversation details for tenancy
  SELECT c.org_id, c.owner_user_id
  INTO v_org_id, v_owner_user_id
  FROM public.conversations c
  WHERE c.id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING errcode = 'P0001';
  END IF;

  -- Check for existing message with same idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT m.id, m.created_at
    INTO v_message_id, v_created_at
    FROM public.messages m
    WHERE m.conversation_id = p_conversation_id
      AND m.idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN QUERY SELECT v_message_id, v_created_at;
      RETURN;
    END IF;
  END IF;

  -- Insert new message
  INSERT INTO public.messages (
    conversation_id,
    org_id,
    owner_user_id,
    author_user_id,
    role,
    content,
    idempotency_key
  ) VALUES (
    p_conversation_id,
    v_org_id,
    v_owner_user_id,
    (SELECT public.jwt_claim('sub')),
    p_role,
    p_content,
    p_idempotency_key
  )
  RETURNING id, created_at
  INTO v_message_id, v_created_at;

  -- Update conversation updated_at
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = p_conversation_id;

  RETURN QUERY SELECT v_message_id, v_created_at;
END;
$$;

-- =============================================================================
-- Triggers
-- =============================================================================

-- Core triggers
DROP TRIGGER IF EXISTS trg_organizations_set_updated_at ON core.organizations;
CREATE TRIGGER trg_organizations_set_updated_at
  BEFORE UPDATE ON core.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_block_slug ON core.organizations;
CREATE TRIGGER trg_organizations_block_slug
  BEFORE UPDATE ON core.organizations
  FOR EACH ROW EXECUTE FUNCTION core.block_slug_update();

DROP TRIGGER IF EXISTS trg_provisioning_workflows_set_updated_at ON core.provisioning_workflows;
CREATE TRIGGER trg_provisioning_workflows_set_updated_at
  BEFORE UPDATE ON core.provisioning_workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_organization_quotas_set_updated_at ON core.organization_quotas;
CREATE TRIGGER trg_organization_quotas_set_updated_at
  BEFORE UPDATE ON core.organization_quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Connect triggers
DROP TRIGGER IF EXISTS trg_data_destinations_set_updated_at ON connect.data_destinations;
CREATE TRIGGER trg_data_destinations_set_updated_at
  BEFORE UPDATE ON connect.data_destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_data_connections_set_updated_at ON connect.data_connections;
CREATE TRIGGER trg_data_connections_set_updated_at
  BEFORE UPDATE ON connect.data_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- System triggers
DROP TRIGGER IF EXISTS trg_audit_events_block ON system.audit_events;
CREATE TRIGGER trg_audit_events_block
  BEFORE UPDATE OR DELETE ON system.audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_update_delete();

DROP TRIGGER IF EXISTS trg_audit_events_set_created_on ON system.audit_events;
CREATE TRIGGER trg_audit_events_set_created_on
  BEFORE INSERT OR UPDATE OF created_at ON system.audit_events
  FOR EACH ROW EXECUTE FUNCTION system.set_audit_events_created_on();

DROP TRIGGER IF EXISTS trg_audit_events_set_seq ON system.audit_events;
CREATE TRIGGER trg_audit_events_set_seq
  BEFORE INSERT ON system.audit_events
  FOR EACH ROW EXECUTE FUNCTION system.set_audit_event_seq();

DROP TRIGGER IF EXISTS trg_system_secrets_set_updated_at ON system.secrets;
CREATE TRIGGER trg_system_secrets_set_updated_at
  BEFORE UPDATE ON system.secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chat triggers
DROP TRIGGER IF EXISTS trg_public_conversations_set_updated_at ON public.conversations;
CREATE TRIGGER trg_public_conversations_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_public_messages_set_updated_at ON public.messages;
CREATE TRIGGER trg_public_messages_set_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- Public Wrapper Functions for Client Access
-- =============================================================================

-- Public wrapper for get_secret (for service operations)
CREATE OR REPLACE FUNCTION public.get_secret(
  p_org_id TEXT,
  p_secret_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, system
AS $$
BEGIN
  RETURN system.get_secret(p_org_id, p_secret_name);
END;
$$;

-- Public wrapper for set_secret (for service operations)
CREATE OR REPLACE FUNCTION public.set_secret(
  p_org_id TEXT,
  p_secret_name TEXT,
  p_secret_value TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, system
AS $$
BEGIN
  PERFORM system.set_secret(p_org_id, p_secret_name, p_secret_value);
END;
$$;

-- =============================================================================
-- Function Permissions
-- =============================================================================

-- Grant execute permissions to service_role
GRANT EXECUTE ON FUNCTION system.set_secret(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.get_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.has_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.delete_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.get_md_sa_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.set_md_sa_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.rate_limit_check(text, text, interval, int) TO service_role;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.jwt_claim(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_tenant_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_from_clerk_mirror(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_append_message(uuid, text, jsonb, text) TO authenticated;

-- Grant execute permissions for public wrapper functions to service_role
GRANT EXECUTE ON FUNCTION public.get_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_secret(TEXT, TEXT, TEXT) TO service_role;

-- Revoke permissions from public
REVOKE ALL ON FUNCTION system.set_secret(TEXT, TEXT, TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION system.get_secret(TEXT, TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION system.has_secret(TEXT, TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION system.delete_secret(TEXT, TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION system.get_md_sa_token(TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION system.set_md_sa_token(TEXT, TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION system.rate_limit_check(text, text, interval, int) FROM public, anon, authenticated;

-- Grant service_role permissions back
GRANT EXECUTE ON FUNCTION system.set_secret(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.get_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.has_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.delete_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.get_md_sa_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.set_md_sa_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.rate_limit_check(text, text, interval, int) TO service_role;

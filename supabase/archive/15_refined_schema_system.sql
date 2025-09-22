-- =============================================================================
-- Refined Schema: System Utilities
-- =============================================================================
-- This migration creates the system schema with improved table names and organization
-- for system utilities like audit events, secrets, rate limiting, and idempotency.

-- Create system schema
CREATE SCHEMA IF NOT EXISTS system;

-- =============================================================================
-- System Tables
-- =============================================================================

-- Audit events table
CREATE TABLE IF NOT EXISTS system.audit_events (
  id             bigserial primary key,
  event_seq      bigint not null,
  org_id         text not null references core.organizations(org_id) on delete cascade,
  provider       text not null,
  type           text not null,
  correlation_id text,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  created_on     date not null default (now() at time zone 'UTC')::date,
  CONSTRAINT chk_audit_events_provider_nonempty CHECK (length(provider) > 0),
  CONSTRAINT chk_audit_events_type_nonempty CHECK (length(type) > 0),
  CONSTRAINT chk_audit_events_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_events_correlation_seq ON system.audit_events (correlation_id, event_seq);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_correlation ON system.audit_events (org_id, correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON system.audit_events (type);
CREATE INDEX IF NOT EXISTS idx_audit_events_payload ON system.audit_events USING gin (payload);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_time ON system.audit_events (org_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_audit_events_type_time ON system.audit_events (type, created_at desc);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created_on ON system.audit_events (org_id, created_on);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_type_time ON system.audit_events (org_id, type, created_at desc);

-- Unique index for vendor deduplication
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_events_vendor_dedupe
  ON system.audit_events (org_id, provider, (payload->>'id'))
  WHERE payload ? 'id';


-- Block update/delete trigger (append-only)
DROP TRIGGER IF EXISTS trg_audit_events_block ON system.audit_events;
CREATE TRIGGER trg_audit_events_block
BEFORE UPDATE OR DELETE ON system.audit_events
FOR EACH STATEMENT EXECUTE FUNCTION public.block_update_delete();

-- Set created_on trigger
CREATE OR REPLACE FUNCTION system.set_audit_events_created_on()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_on := (coalesce(NEW.created_at, now()) at time zone 'UTC')::date;
  RETURN NEW;
END;
$$;
ALTER FUNCTION system.set_audit_events_created_on() SET search_path = pg_catalog, system;

DROP TRIGGER IF EXISTS trg_audit_events_set_created_on ON system.audit_events;
CREATE TRIGGER trg_audit_events_set_created_on
BEFORE INSERT OR UPDATE OF created_at ON system.audit_events
FOR EACH ROW EXECUTE FUNCTION system.set_audit_events_created_on();

-- Set event sequence trigger
CREATE OR REPLACE FUNCTION system.set_audit_event_seq()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_next bigint;
BEGIN
  IF NEW.correlation_id IS NULL THEN
    -- Ensure a correlation is always present to maintain ordering semantics
    NEW.correlation_id := (extensions.gen_random_uuid())::text;
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
ALTER FUNCTION system.set_audit_event_seq() SET search_path = pg_catalog, system;

DROP TRIGGER IF EXISTS trg_audit_events_set_seq ON system.audit_events;
CREATE TRIGGER trg_audit_events_set_seq
BEFORE INSERT ON system.audit_events
FOR EACH ROW EXECUTE FUNCTION system.set_audit_event_seq();

-- Secrets table
CREATE TABLE IF NOT EXISTS system.secrets (
  id           uuid primary key default gen_random_uuid(),
  org_id       text not null references core.organizations(org_id) on delete cascade,
  secret_name  text not null,
  secret_value text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  CONSTRAINT uq_system_secrets_org_name UNIQUE (org_id, secret_name),
  CONSTRAINT chk_system_secrets_secret_name_nonempty CHECK (length(secret_name) > 0),
  CONSTRAINT chk_system_secrets_secret_value_nonempty CHECK (length(secret_value) > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_system_secrets_org_id ON system.secrets (org_id);
CREATE INDEX IF NOT EXISTS idx_system_secrets_name ON system.secrets (secret_name);
CREATE INDEX IF NOT EXISTS idx_system_secrets_org_name ON system.secrets (org_id, secret_name);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_system_secrets_set_updated_at ON system.secrets;
CREATE TRIGGER trg_system_secrets_set_updated_at
  BEFORE UPDATE ON system.secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS system.idempotency_keys (
  key           text primary key,
  org_id        text not null references core.organizations(org_id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_result   jsonb,
  CONSTRAINT chk_system_idempotency_nonempty CHECK (length(key) > 0),
  CONSTRAINT chk_system_idempotency_last_result_object CHECK (last_result IS NULL OR jsonb_typeof(last_result) = 'object')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_system_idempotency_org ON system.idempotency_keys (org_id);
CREATE INDEX IF NOT EXISTS idx_system_idempotency_first_seen ON system.idempotency_keys (first_seen_at desc);

-- Rate limits table
CREATE TABLE IF NOT EXISTS system.rate_limits (
  user_id      text not null,
  action       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  CONSTRAINT pk_system_rate_limits PRIMARY KEY (user_id, action, window_start),
  CONSTRAINT chk_system_rate_limits_count_nonnegative CHECK (count >= 0)
);

-- =============================================================================
-- System Functions
-- =============================================================================

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

-- Grant execute permission only to service role
ALTER FUNCTION system.set_secret(TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION system.set_secret(TEXT, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION system.set_secret(TEXT, TEXT, TEXT) TO service_role;

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

-- Grant execute permission only to service role
ALTER FUNCTION system.get_secret(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION system.get_secret(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION system.get_secret(TEXT, TEXT) TO service_role;

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

-- Grant execute permission only to service role
ALTER FUNCTION system.has_secret(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION system.has_secret(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION system.has_secret(TEXT, TEXT) TO service_role;

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

-- Grant execute permission only to service role
ALTER FUNCTION system.delete_secret(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION system.delete_secret(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION system.delete_secret(TEXT, TEXT) TO service_role;

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

-- Grant execute permission only to service role
ALTER FUNCTION system.get_md_sa_token(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION system.get_md_sa_token(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION system.get_md_sa_token(TEXT) TO service_role;

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

-- Grant execute permission only to service role
ALTER FUNCTION system.set_md_sa_token(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION system.set_md_sa_token(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION system.set_md_sa_token(TEXT, TEXT) TO service_role;

-- Rate limiting function
CREATE OR REPLACE FUNCTION system.rate_limit_check(p_user_id text, p_action text, p_window interval, p_limit int)
RETURNS void
LANGUAGE plpgsql
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

-- Harden and elevate for server-side execution
ALTER FUNCTION system.rate_limit_check(text, text, interval, int)
  OWNER TO postgres;
ALTER FUNCTION system.rate_limit_check(text, text, interval, int)
  SECURITY DEFINER;
ALTER FUNCTION system.rate_limit_check(text, text, interval, int)
  SET search_path = pg_catalog, system;

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE system.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.rate_limits ENABLE ROW LEVEL SECURITY;

-- Audit events policies
DROP POLICY IF EXISTS audit_events_select_org ON system.audit_events;
CREATE POLICY audit_events_select_org
  ON system.audit_events FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS audit_events_insert_org ON system.audit_events;
CREATE POLICY audit_events_insert_org
  ON system.audit_events FOR INSERT
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

-- Secrets policies (service role only)
CREATE POLICY "Service role only" ON system.secrets
  FOR ALL TO service_role USING (true);

-- Deny all other access to secrets
CREATE POLICY "Deny all other access" ON system.secrets
  AS RESTRICTIVE TO public USING (false);

-- Idempotency keys policies
DROP POLICY IF EXISTS idempotency_keys_select_org ON system.idempotency_keys;
CREATE POLICY idempotency_keys_select_org
  ON system.idempotency_keys FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

-- Rate limits policies (no access for regular users)
DROP POLICY IF EXISTS rate_limits_select_none ON system.rate_limits;
CREATE POLICY rate_limits_select_none ON system.rate_limits FOR SELECT USING (false);

-- =============================================================================
-- Permissions
-- =============================================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA system TO authenticated;
GRANT SELECT ON TABLE system.audit_events TO authenticated;
GRANT INSERT ON TABLE system.audit_events TO authenticated;
GRANT SELECT ON TABLE system.idempotency_keys TO authenticated;

-- Grant permissions to service_role
GRANT USAGE ON SCHEMA system TO service_role;
GRANT ALL ON TABLE system.audit_events TO service_role;
GRANT ALL ON TABLE system.secrets TO service_role;
GRANT ALL ON TABLE system.idempotency_keys TO service_role;
GRANT ALL ON TABLE system.rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION system.set_secret(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.get_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.has_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.delete_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.get_md_sa_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.set_md_sa_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system.rate_limit_check(text, text, interval, int) TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON SCHEMA system IS 'System utilities including audit events, secrets, rate limiting, and idempotency';
COMMENT ON TABLE system.audit_events IS 'Append-only event log (webhooks + system). created_on is UTC date via trigger.';
COMMENT ON TABLE system.secrets IS 'Secure secrets storage per organization';
COMMENT ON TABLE system.idempotency_keys IS 'Idempotency cache for long-running sagas';
COMMENT ON TABLE system.rate_limits IS 'Per-user action counters for rate limiting (server-only)';

COMMENT ON COLUMN system.audit_events.org_id IS 'Owning organization id';
COMMENT ON COLUMN system.audit_events.provider IS 'Event provider/source (system, fivetran, motherduck, ui)';
COMMENT ON COLUMN system.audit_events.type IS 'Event type (e.g., provision.started)';
COMMENT ON COLUMN system.audit_events.correlation_id IS 'Correlation id per saga/run';
COMMENT ON COLUMN system.audit_events.payload IS 'Event payload (JSON object)';
COMMENT ON COLUMN system.audit_events.created_at IS 'Event creation time';
COMMENT ON COLUMN system.audit_events.created_on IS 'UTC date derived from created_at';
COMMENT ON COLUMN system.audit_events.event_seq IS 'Monotonic sequence per correlation_id';

COMMENT ON COLUMN system.secrets.org_id IS 'Owning organization id';
COMMENT ON COLUMN system.secrets.secret_name IS 'Secret name identifier';
COMMENT ON COLUMN system.secrets.secret_value IS 'Encrypted secret value';

COMMENT ON COLUMN system.idempotency_keys.key IS 'Idempotency key string';
COMMENT ON COLUMN system.idempotency_keys.org_id IS 'Owning organization id';
COMMENT ON COLUMN system.idempotency_keys.first_seen_at IS 'First time this key was seen';
COMMENT ON COLUMN system.idempotency_keys.last_result IS 'Cached result payload (JSON)';

COMMENT ON COLUMN system.rate_limits.user_id IS 'User id for rate limiting bucket';
COMMENT ON COLUMN system.rate_limits.action IS 'Action name for rate limiting';
COMMENT ON COLUMN system.rate_limits.window_start IS 'Bucket window start time (minute granularity)';
COMMENT ON COLUMN system.rate_limits.count IS 'Requests in current bucket';

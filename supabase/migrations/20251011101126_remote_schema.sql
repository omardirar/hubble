


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "clerk";


ALTER SCHEMA "clerk" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "clerk_dev";


ALTER SCHEMA "clerk_dev" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "connect";


ALTER SCHEMA "connect" OWNER TO "postgres";


COMMENT ON SCHEMA "connect" IS 'Data connection and integration features including destinations, connectors, and types';



CREATE SCHEMA IF NOT EXISTS "core";


ALTER SCHEMA "core" OWNER TO "postgres";


COMMENT ON SCHEMA "core" IS 'Core business entities including organizations, provisioning workflows, and quotas';



CREATE SCHEMA IF NOT EXISTS "fivetran_log";


ALTER SCHEMA "fivetran_log" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "system";


ALTER SCHEMA "system" OWNER TO "postgres";


COMMENT ON SCHEMA "system" IS 'System utilities including audit events, secrets, rate limiting, and idempotency';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






CREATE TYPE "connect"."connection_status_t" AS ENUM (
    'not_configured',
    'needs_auth',
    'syncing',
    'healthy',
    'paused',
    'error'
);


ALTER TYPE "connect"."connection_status_t" OWNER TO "postgres";


CREATE TYPE "connect"."destination_status_t" AS ENUM (
    'pending',
    'healthy',
    'unhealthy'
);


ALTER TYPE "connect"."destination_status_t" OWNER TO "postgres";


CREATE TYPE "core"."organization_status_t" AS ENUM (
    'provisioning',
    'ready',
    'suspended',
    'failed',
    'running'
);


ALTER TYPE "core"."organization_status_t" OWNER TO "postgres";


CREATE TYPE "core"."provisioning_status_t" AS ENUM (
    'pending',
    'running',
    'ready',
    'failed'
);


ALTER TYPE "core"."provisioning_status_t" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."block_slug_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'core', 'pg_catalog'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'slug updates are not allowed; create a new organization instead';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "core"."block_slug_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_update_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RAISE EXCEPTION 'Updates and deletes are not allowed on this table';
END;
$$;


ALTER FUNCTION "public"."block_update_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_jwt"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RETURN auth.jwt();
EXCEPTION
  WHEN OTHERS THEN
    RETURN '{"error": "Failed to get JWT"}'::jsonb;
END;
$$;


ALTER FUNCTION "public"."debug_jwt"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_tenant_exists"("p_org_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."ensure_tenant_exists"("p_org_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_from_clerk_mirror"("p_org_id" "text") RETURNS TABLE("org_id" "text", "slug" "text", "name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."get_org_from_clerk_mirror"("p_org_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_secret"("p_org_id" "text", "p_secret_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'system'
    AS $$
BEGIN
  RETURN system.get_secret(p_org_id, p_secret_name);
END;
$$;


ALTER FUNCTION "public"."get_secret"("p_org_id" "text", "p_secret_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jwt_claim"("claim" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
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


ALTER FUNCTION "public"."jwt_claim"("claim" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_append_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "jsonb", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
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


ALTER FUNCTION "public"."rpc_append_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "jsonb", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_secret"("p_org_id" "text", "p_secret_name" "text", "p_secret_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'system'
    AS $$
BEGIN
  PERFORM system.set_secret(p_org_id, p_secret_name, p_secret_value);
END;
$$;


ALTER FUNCTION "public"."set_secret"("p_org_id" "text", "p_secret_name" "text", "p_secret_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."delete_secret"("p_org_id" "text", "p_secret_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'system'
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


ALTER FUNCTION "system"."delete_secret"("p_org_id" "text", "p_secret_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."get_md_sa_token"("p_org_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'system'
    AS $$
BEGIN
  RETURN system.get_secret(p_org_id, 'md_sa_token');
END;
$$;


ALTER FUNCTION "system"."get_md_sa_token"("p_org_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."get_secret"("p_org_id" "text", "p_secret_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'system'
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


ALTER FUNCTION "system"."get_secret"("p_org_id" "text", "p_secret_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."has_secret"("p_org_id" "text", "p_secret_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'system'
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


ALTER FUNCTION "system"."has_secret"("p_org_id" "text", "p_secret_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."rate_limit_check"("p_user_id" "text", "p_action" "text", "p_window" interval, "p_limit" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'system', 'pg_catalog'
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


ALTER FUNCTION "system"."rate_limit_check"("p_user_id" "text", "p_action" "text", "p_window" interval, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."set_audit_event_seq"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'system', 'pg_catalog'
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


ALTER FUNCTION "system"."set_audit_event_seq"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."set_audit_events_created_on"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'system', 'pg_catalog'
    AS $$
BEGIN
  NEW.created_on := (coalesce(NEW.created_at, now()) AT TIME ZONE 'UTC')::date;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "system"."set_audit_events_created_on"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."set_md_sa_token"("p_org_id" "text", "p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'system'
    AS $$
BEGIN
  PERFORM system.set_secret(p_org_id, 'md_sa_token', p_token);
END;
$$;


ALTER FUNCTION "system"."set_md_sa_token"("p_org_id" "text", "p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "system"."set_secret"("p_org_id" "text", "p_secret_name" "text", "p_secret_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'system'
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


ALTER FUNCTION "system"."set_secret"("p_org_id" "text", "p_secret_name" "text", "p_secret_value" "text") OWNER TO "postgres";


CREATE FOREIGN DATA WRAPPER "dev_wasm_wrapper" HANDLER "extensions"."wasm_fdw_handler" VALIDATOR "extensions"."wasm_fdw_validator";




CREATE FOREIGN DATA WRAPPER "prod_wasm_wrapper" HANDLER "extensions"."wasm_fdw_handler" VALIDATOR "extensions"."wasm_fdw_validator";




CREATE SERVER "clerk_dev_server" FOREIGN DATA WRAPPER "dev_wasm_wrapper" OPTIONS (
    "api_key_id" 'ef4b3d1a-5bfa-4144-8b97-cbbfa57221d7',
    "api_url" 'https://api.clerk.com/v1',
    "fdw_package_checksum" '89337bb11779d4d654cd3e54391aabd02509d213db6995f7dd58951774bf0e37',
    "fdw_package_name" 'supabase:clerk-fdw',
    "fdw_package_url" 'https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.2.0/clerk_fdw.wasm',
    "fdw_package_version" '0.2.0'
);


ALTER SERVER "clerk_dev_server" OWNER TO "postgres";


CREATE SERVER "clerk_server" FOREIGN DATA WRAPPER "prod_wasm_wrapper" OPTIONS (
    "api_key_id" '204da3d9-fe29-4389-88d5-e7fe4d64822c',
    "api_url" 'https://api.clerk.com/v1',
    "fdw_package_checksum" '89337bb11779d4d654cd3e54391aabd02509d213db6995f7dd58951774bf0e37',
    "fdw_package_name" 'supabase:clerk-fdw',
    "fdw_package_url" 'https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.2.0/clerk_fdw.wasm',
    "fdw_package_version" '0.2.0'
);


ALTER SERVER "clerk_server" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."allowlist_identifiers" (
    "id" "text",
    "invitation_id" "text",
    "identifier" "text",
    "identifier_type" "text",
    "instance_id" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'allowlist_identifiers'
);


ALTER FOREIGN TABLE "clerk"."allowlist_identifiers" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."blocklist_identifiers" (
    "id" "text",
    "identifier" "text",
    "identifier_type" "text",
    "instance_id" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'blocklist_identifiers'
);


ALTER FOREIGN TABLE "clerk"."blocklist_identifiers" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."domains" (
    "id" "text",
    "name" "text",
    "is_satellite" boolean,
    "frontend_api_url" "text",
    "accounts_portal_url" "text",
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'domains'
);


ALTER FOREIGN TABLE "clerk"."domains" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."invitations" (
    "id" "text",
    "email_address" "text",
    "url" "text",
    "revoked" boolean,
    "status" "text",
    "expires_at" timestamp without time zone,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'invitations'
);


ALTER FOREIGN TABLE "clerk"."invitations" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."jwt_templates" (
    "id" "text",
    "name" "text",
    "lifetime" bigint,
    "allowed_clock_skew" bigint,
    "custom_signing_key" boolean,
    "signing_algorithm" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'jwt_templates'
);


ALTER FOREIGN TABLE "clerk"."jwt_templates" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."oauth_applications" (
    "id" "text",
    "name" "text",
    "instance_id" "text",
    "client_id" "text",
    "public" boolean,
    "scopes" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'oauth_applications'
);


ALTER FOREIGN TABLE "clerk"."oauth_applications" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."organization_invitations" (
    "id" "text",
    "email_address" "text",
    "role" "text",
    "role_name" "text",
    "organization_id" "text",
    "status" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'organization_invitations'
);


ALTER FOREIGN TABLE "clerk"."organization_invitations" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."organization_memberships" (
    "id" "text",
    "role" "text",
    "role_name" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'organization_memberships'
);


ALTER FOREIGN TABLE "clerk"."organization_memberships" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."organizations" (
    "id" "text",
    "name" "text",
    "slug" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'organizations'
);


ALTER FOREIGN TABLE "clerk"."organizations" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."redirect_urls" (
    "id" "text",
    "url" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'redirect_urls'
);


ALTER FOREIGN TABLE "clerk"."redirect_urls" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."saml_connections" (
    "id" "text",
    "name" "text",
    "domain" "text",
    "active" boolean,
    "provider" "text",
    "user_count" bigint,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'saml_connections'
);


ALTER FOREIGN TABLE "clerk"."saml_connections" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk"."users" (
    "id" "text",
    "external_id" "text",
    "username" "text",
    "first_name" "text",
    "last_name" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_server"
OPTIONS (
    "object" 'users'
);


ALTER FOREIGN TABLE "clerk"."users" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."allowlist_identifiers" (
    "id" "text",
    "invitation_id" "text",
    "identifier" "text",
    "identifier_type" "text",
    "instance_id" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'allowlist_identifiers'
);


ALTER FOREIGN TABLE "clerk_dev"."allowlist_identifiers" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."blocklist_identifiers" (
    "id" "text",
    "identifier" "text",
    "identifier_type" "text",
    "instance_id" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'blocklist_identifiers'
);


ALTER FOREIGN TABLE "clerk_dev"."blocklist_identifiers" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."domains" (
    "id" "text",
    "name" "text",
    "is_satellite" boolean,
    "frontend_api_url" "text",
    "accounts_portal_url" "text",
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'domains'
);


ALTER FOREIGN TABLE "clerk_dev"."domains" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."invitations" (
    "id" "text",
    "email_address" "text",
    "url" "text",
    "revoked" boolean,
    "status" "text",
    "expires_at" timestamp without time zone,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'invitations'
);


ALTER FOREIGN TABLE "clerk_dev"."invitations" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."jwt_templates" (
    "id" "text",
    "name" "text",
    "lifetime" bigint,
    "allowed_clock_skew" bigint,
    "custom_signing_key" boolean,
    "signing_algorithm" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'jwt_templates'
);


ALTER FOREIGN TABLE "clerk_dev"."jwt_templates" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."oauth_applications" (
    "id" "text",
    "name" "text",
    "instance_id" "text",
    "client_id" "text",
    "public" boolean,
    "scopes" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'oauth_applications'
);


ALTER FOREIGN TABLE "clerk_dev"."oauth_applications" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."organization_invitations" (
    "id" "text",
    "email_address" "text",
    "role" "text",
    "role_name" "text",
    "organization_id" "text",
    "status" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'organization_invitations'
);


ALTER FOREIGN TABLE "clerk_dev"."organization_invitations" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."organization_memberships" (
    "id" "text",
    "role" "text",
    "role_name" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'organization_memberships'
);


ALTER FOREIGN TABLE "clerk_dev"."organization_memberships" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."organizations" (
    "id" "text",
    "name" "text",
    "slug" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'organizations'
);


ALTER FOREIGN TABLE "clerk_dev"."organizations" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."redirect_urls" (
    "id" "text",
    "url" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'redirect_urls'
);


ALTER FOREIGN TABLE "clerk_dev"."redirect_urls" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."saml_connections" (
    "id" "text",
    "name" "text",
    "domain" "text",
    "active" boolean,
    "provider" "text",
    "user_count" bigint,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'saml_connections'
);


ALTER FOREIGN TABLE "clerk_dev"."saml_connections" OWNER TO "postgres";


CREATE FOREIGN TABLE "clerk_dev"."users" (
    "id" "text",
    "external_id" "text",
    "username" "text",
    "first_name" "text",
    "last_name" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "clerk_dev_server"
OPTIONS (
    "object" 'users'
);


ALTER FOREIGN TABLE "clerk_dev"."users" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "connect"."connector_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL
);


ALTER TABLE "connect"."connector_types" OWNER TO "postgres";


COMMENT ON TABLE "connect"."connector_types" IS 'Allowed connector types; referenced by data_connections.source_type';



COMMENT ON COLUMN "connect"."connector_types"."code" IS 'Unique identifier for connector type';



COMMENT ON COLUMN "connect"."connector_types"."label" IS 'Human-readable display name for connector type';



CREATE TABLE IF NOT EXISTS "connect"."data_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "fivetran_connector_id" "text",
    "schema_name" "text",
    "status" "connect"."connection_status_t" DEFAULT 'not_configured'::"connect"."connection_status_t" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_data_connections_schema_name_nonempty" CHECK ((("schema_name" IS NULL) OR ("length"("schema_name") > 0)))
);


ALTER TABLE "connect"."data_connections" OWNER TO "postgres";


COMMENT ON TABLE "connect"."data_connections" IS 'Per-organization Fivetran connectors (one per source_type)';



CREATE TABLE IF NOT EXISTS "connect"."data_destinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "text" NOT NULL,
    "md_db_name" "text" NOT NULL,
    "md_token_ref" "text" NOT NULL,
    "fivetran_destination_id" "text",
    "status" "connect"."destination_status_t" DEFAULT 'pending'::"connect"."destination_status_t" NOT NULL,
    "last_event_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_data_destinations_md_db_name_format" CHECK (("md_db_name" ~ '^md_[a-zA-Z0-9_-]+$'::"text")),
    CONSTRAINT "chk_data_destinations_md_token_ref_nonempty" CHECK (("length"("md_token_ref") > 0))
);


ALTER TABLE "connect"."data_destinations" OWNER TO "postgres";


COMMENT ON TABLE "connect"."data_destinations" IS 'Per-organization MotherDuck DB + Fivetran destination metadata';



CREATE TABLE IF NOT EXISTS "fivetran_log"."connection" (
    "connection_id" character varying(256) NOT NULL,
    "connecting_user_id" character varying(256),
    "connector_type_id" character varying(256),
    "connection_name" character varying(256),
    "signed_up" timestamp with time zone,
    "paused" boolean,
    "sync_frequency" integer,
    "deployment_type" character varying(256),
    "_fivetran_deleted" boolean,
    "destination_id" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."connection" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."connector_type" (
    "id" character varying(256) NOT NULL,
    "official_connector_name" character varying(256),
    "type" character varying(256),
    "availability" character varying(256),
    "created_at" timestamp with time zone,
    "public_beta_at" timestamp with time zone,
    "release_at" timestamp with time zone,
    "deleted" boolean,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."connector_type" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."destination" (
    "id" character varying(256) NOT NULL,
    "name" character varying(256),
    "account_id" character varying(256),
    "created_at" timestamp with time zone,
    "region" character varying(256),
    "is_active" boolean,
    "deployment_type" character varying(256),
    "destination_type" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."destination" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."log" (
    "id" character varying(256) NOT NULL,
    "time_stamp" timestamp with time zone NOT NULL,
    "connection_id" character varying(256),
    "event" character varying(256),
    "message_event" character varying(256),
    "message_data" character varying(4096),
    "sync_id" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."log" OWNER TO "postgres";


CREATE OR REPLACE VIEW "connect"."v_fivetran_connection_overview" WITH ("security_invoker"='true') AS
 SELECT "dc"."id" AS "local_connection_id",
    "dc"."org_id",
    "dc"."source_type",
    "dc"."schema_name",
    "dc"."fivetran_connector_id",
    "fc"."connection_name",
    "ct"."official_connector_name",
    "ct"."type" AS "connector_type",
        CASE
            WHEN ("fc"."_fivetran_deleted" = true) THEN 'deleted'::"text"
            WHEN ("fc"."paused" = true) THEN 'paused'::"text"
            WHEN ("fc"."connection_id" IS NULL) THEN 'not_configured'::"text"
            ELSE 'active'::"text"
        END AS "status",
    "fc"."paused",
    "fc"."sync_frequency",
    "last_sync"."last_successful_sync_at",
    "fc"."deployment_type",
    "d"."name" AS "destination_name",
    "d"."region" AS "destination_region"
   FROM (((("connect"."data_connections" "dc"
     LEFT JOIN "fivetran_log"."connection" "fc" ON (("dc"."fivetran_connector_id" = ("fc"."connection_id")::"text")))
     LEFT JOIN "fivetran_log"."connector_type" "ct" ON ((("fc"."connector_type_id")::"text" = ("ct"."id")::"text")))
     LEFT JOIN "fivetran_log"."destination" "d" ON ((("fc"."destination_id")::"text" = ("d"."id")::"text")))
     LEFT JOIN LATERAL ( SELECT "max"("l"."time_stamp") AS "last_successful_sync_at"
           FROM "fivetran_log"."log" "l"
          WHERE ((("l"."connection_id")::"text" = "dc"."fivetran_connector_id") AND (("l"."message_event")::"text" = 'sync_end'::"text") AND (("l"."message_data")::"text" = '{"status":"SUCCESSFUL"}'::"text"))) "last_sync" ON (true));


ALTER VIEW "connect"."v_fivetran_connection_overview" OWNER TO "postgres";


COMMENT ON VIEW "connect"."v_fivetran_connection_overview" IS 'Fivetran connection overview with basic info: connector, status, last successful sync, and identifiers';



CREATE TABLE IF NOT EXISTS "core"."organization_quotas" (
    "org_id" "text" NOT NULL,
    "max_connectors" integer,
    "max_storage_gb_est" numeric(10,2),
    "max_daily_rows" bigint,
    "max_query_runtime_ms" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_organization_quotas_positive" CHECK (((("max_connectors" IS NULL) OR ("max_connectors" > 0)) AND (("max_storage_gb_est" IS NULL) OR ("max_storage_gb_est" > (0)::numeric)) AND (("max_daily_rows" IS NULL) OR ("max_daily_rows" > 0)) AND (("max_query_runtime_ms" IS NULL) OR ("max_query_runtime_ms" > 0))))
);


ALTER TABLE "core"."organization_quotas" OWNER TO "postgres";


COMMENT ON TABLE "core"."organization_quotas" IS 'Usage quotas and limits per organization';



CREATE TABLE IF NOT EXISTS "core"."organizations" (
    "org_id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "core"."organization_status_t" DEFAULT 'provisioning'::"core"."organization_status_t" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_organizations_org_id_format" CHECK (("org_id" ~ '^org_[a-zA-Z0-9]+$'::"text")),
    CONSTRAINT "chk_organizations_slug_format" CHECK ((("slug" ~ '^[a-z0-9-]+$'::"text") AND ("length"("slug") >= 3)))
);


ALTER TABLE "core"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "core"."organizations" IS 'Organization registry keyed by org_id; 1:1 with auth org';



CREATE TABLE IF NOT EXISTS "core"."provisioning_workflows" (
    "correlation_id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "org_id" "text" NOT NULL,
    "status" "core"."provisioning_status_t" DEFAULT 'pending'::"core"."provisioning_status_t" NOT NULL,
    "md_db_name" "text",
    "md_sa_username" "text",
    "fivetran_destination_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_provisioning_workflows_correlation_id_format" CHECK (("correlation_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text")),
    CONSTRAINT "chk_provisioning_workflows_finished_after_started" CHECK ((("finished_at" IS NULL) OR ("finished_at" >= "started_at"))),
    CONSTRAINT "chk_provisioning_workflows_md_db_name_format" CHECK ((("md_db_name" IS NULL) OR ("md_db_name" ~ '^md_[a-zA-Z0-9_-]+$'::"text"))),
    CONSTRAINT "chk_provisioning_workflows_metadata_object" CHECK (("jsonb_typeof"("metadata") = 'object'::"text"))
);


ALTER TABLE "core"."provisioning_workflows" OWNER TO "postgres";


COMMENT ON TABLE "core"."provisioning_workflows" IS 'Tracks per-enable provisioning attempts per org (correlation_id/status/metadata)';



CREATE TABLE IF NOT EXISTS "fivetran_log"."account" (
    "id" character varying(256) NOT NULL,
    "name" character varying(256),
    "created_at" timestamp with time zone,
    "status" character varying(256),
    "country" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."account" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."audit_trail" (
    "captured_at" timestamp with time zone NOT NULL,
    "id" character varying(256) NOT NULL,
    "action" character varying(256),
    "user_id" character varying(256),
    "interaction_method" character varying(256),
    "primary_resource_type" character varying(256),
    "primary_resource_id" character varying(256),
    "secondary_resource_type" character varying(256),
    "secondary_resource_id" character varying(256),
    "old_values" character varying(256),
    "new_values" character varying(512),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."audit_trail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."column_lineage" (
    "destination_column_id" bigint NOT NULL,
    "source_column_id" bigint NOT NULL,
    "created_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."column_lineage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."destination_column" (
    "id" bigint NOT NULL,
    "destination_id" character varying(256),
    "table_id" bigint,
    "connection_id" character varying(256),
    "name" character varying(256),
    "type" character varying(256),
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."destination_column" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."destination_column_change_event" (
    "attribute_name" character varying(256) NOT NULL,
    "column_id" bigint NOT NULL,
    "detected_at" timestamp with time zone NOT NULL,
    "destination_id" character varying(256),
    "connection_id" character varying(256),
    "change_type" character varying(256),
    "new_value" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."destination_column_change_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."destination_schema" (
    "id" integer NOT NULL,
    "destination_id" character varying(256),
    "connection_id" character varying(256),
    "name" character varying(256),
    "created_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."destination_schema" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."destination_schema_change_event" (
    "detected_at" timestamp with time zone NOT NULL,
    "schema_id" integer NOT NULL,
    "destination_id" character varying(256),
    "connection_id" character varying(256),
    "change_type" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."destination_schema_change_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."destination_table" (
    "id" bigint NOT NULL,
    "destination_id" character varying(256),
    "schema_id" integer,
    "connection_id" character varying(256),
    "name" character varying(256),
    "created_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."destination_table" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."destination_table_change_event" (
    "detected_at" timestamp with time zone NOT NULL,
    "table_id" bigint NOT NULL,
    "destination_id" character varying(256),
    "connection_id" character varying(256),
    "change_type" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."destination_table_change_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."incremental_mar" (
    "connection_name" character varying(256) NOT NULL,
    "destination_id" character varying(256) NOT NULL,
    "measured_date" "date" NOT NULL,
    "schema_name" character varying(256) NOT NULL,
    "sync_type" character varying(256) NOT NULL,
    "table_name" character varying(256) NOT NULL,
    "free_type" character varying(256) NOT NULL,
    "updated_at" timestamp with time zone,
    "incremental_rows" bigint,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."incremental_mar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."resource_membership" (
    "id" bigint NOT NULL,
    "role_id" character varying(256),
    "team_id" character varying(256),
    "user_id" character varying(256),
    "account_id" character varying(256),
    "destination_id" character varying(256),
    "connection_id" character varying(256),
    "organization_id" character varying(256),
    "created_at" timestamp with time zone,
    "_fivetran_deleted" boolean,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."resource_membership" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."role" (
    "id" character varying(256) NOT NULL,
    "name" character varying(256),
    "description" character varying(512),
    "account_id" character varying(256),
    "connector_types" "jsonb",
    "_fivetran_deleted" boolean,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."role" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."role_permission" (
    "role_id" character varying(256) NOT NULL,
    "permission" character varying(256) NOT NULL,
    "_fivetran_deleted" boolean,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."role_permission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."schema_lineage" (
    "destination_schema_id" integer NOT NULL,
    "source_schema_id" integer NOT NULL,
    "created_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."schema_lineage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."source_column" (
    "id" bigint NOT NULL,
    "connection_id" character varying(256),
    "table_id" bigint,
    "name" character varying(256),
    "type" character varying(256),
    "is_primary_key" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."source_column" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."source_column_change_event" (
    "attribute_name" character varying(256) NOT NULL,
    "column_id" bigint NOT NULL,
    "detected_at" timestamp with time zone NOT NULL,
    "entity_type" character varying(256) NOT NULL,
    "connection_id" character varying(256),
    "change_type" character varying(256),
    "new_value" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."source_column_change_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."source_schema" (
    "id" integer NOT NULL,
    "connection_id" character varying(256),
    "name" character varying(256),
    "created_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."source_schema" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."source_schema_change_event" (
    "detected_at" timestamp with time zone NOT NULL,
    "schema_id" integer NOT NULL,
    "connection_id" character varying(256),
    "change_type" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."source_schema_change_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."source_table" (
    "id" bigint NOT NULL,
    "connection_id" character varying(256),
    "schema_id" integer,
    "name" character varying(256),
    "created_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."source_table" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."source_table_change_event" (
    "detected_at" timestamp with time zone NOT NULL,
    "table_id" bigint NOT NULL,
    "connection_id" character varying(256),
    "change_type" character varying(256),
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."source_table_change_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."table_lineage" (
    "destination_table_id" bigint NOT NULL,
    "source_table_id" bigint NOT NULL,
    "created_at" timestamp with time zone,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."table_lineage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "fivetran_log"."user" (
    "id" character varying(256) NOT NULL,
    "given_name" character varying(256),
    "family_name" character varying(256),
    "email" character varying(256),
    "email_disabled" boolean,
    "verified" boolean,
    "created_at" timestamp with time zone,
    "phone" character varying(256),
    "_fivetran_deleted" boolean,
    "_fivetran_synced" timestamp with time zone
);


ALTER TABLE "fivetran_log"."user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "system"."audit_events" (
    "id" bigint NOT NULL,
    "event_seq" bigint NOT NULL,
    "org_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "type" "text" NOT NULL,
    "correlation_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_on" "date" DEFAULT (("now"() AT TIME ZONE 'UTC'::"text"))::"date" NOT NULL,
    CONSTRAINT "chk_audit_events_payload_object" CHECK (("jsonb_typeof"("payload") = 'object'::"text")),
    CONSTRAINT "chk_audit_events_provider_nonempty" CHECK (("length"("provider") > 0)),
    CONSTRAINT "chk_audit_events_type_nonempty" CHECK (("length"("type") > 0))
);


ALTER TABLE "system"."audit_events" OWNER TO "postgres";


COMMENT ON TABLE "system"."audit_events" IS 'Append-only event log (webhooks + system). created_on is UTC date via trigger.';



CREATE OR REPLACE VIEW "public"."audit_events" WITH ("security_invoker"='true') AS
 SELECT "id",
    "event_seq",
    "org_id",
    "provider",
    "type",
    "correlation_id",
    "payload",
    "created_at",
    "created_on"
   FROM "system"."audit_events";


ALTER VIEW "public"."audit_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."connector_types" WITH ("security_invoker"='true') AS
 SELECT "code",
    "label"
   FROM "connect"."connector_types";


ALTER VIEW "public"."connector_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "text" NOT NULL,
    "owner_user_id" "text" NOT NULL,
    "title" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "model" "text",
    "system_prompt" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'Chat conversations per organization and user (public schema for Supabase client)';



CREATE OR REPLACE VIEW "public"."data_connections" WITH ("security_invoker"='true') AS
 SELECT "id",
    "org_id",
    "source_type",
    "fivetran_connector_id",
    "schema_name",
    "status",
    "created_at",
    "updated_at"
   FROM "connect"."data_connections";


ALTER VIEW "public"."data_connections" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."data_destinations" WITH ("security_invoker"='true') AS
 SELECT "id",
    "org_id",
    "md_db_name",
    "md_token_ref",
    "fivetran_destination_id",
    "status",
    "last_event_at",
    "created_at",
    "updated_at"
   FROM "connect"."data_destinations";


ALTER VIEW "public"."data_destinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "system"."idempotency_keys" (
    "key" "text" NOT NULL,
    "org_id" "text" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_result" "jsonb",
    CONSTRAINT "chk_system_idempotency_last_result_object" CHECK ((("last_result" IS NULL) OR ("jsonb_typeof"("last_result") = 'object'::"text"))),
    CONSTRAINT "chk_system_idempotency_nonempty" CHECK (("length"("key") > 0))
);


ALTER TABLE "system"."idempotency_keys" OWNER TO "postgres";


COMMENT ON TABLE "system"."idempotency_keys" IS 'Idempotency cache for long-running sagas';



CREATE OR REPLACE VIEW "public"."idempotency_keys" WITH ("security_invoker"='true') AS
 SELECT "key",
    "org_id",
    "first_seen_at",
    "last_result"
   FROM "system"."idempotency_keys";


ALTER VIEW "public"."idempotency_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "org_id" "text" NOT NULL,
    "owner_user_id" "text" NOT NULL,
    "author_user_id" "text",
    "role" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "text_content" "text" GENERATED ALWAYS AS (
CASE
    WHEN ("jsonb_typeof"("content") = 'string'::"text") THEN TRIM(BOTH '"'::"text" FROM ("content")::"text")
    WHEN ("content" ? 'text'::"text") THEN ("content" ->> 'text'::"text")
    ELSE NULL::"text"
END) STORED,
    "model" "text",
    "tool_name" "text",
    "tool_call_id" "text",
    "error" "text",
    "idempotency_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text", 'tool'::"text", 'function'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Chat messages within conversations (public schema for Supabase client)';



CREATE OR REPLACE VIEW "public"."organization_quotas" WITH ("security_invoker"='true') AS
 SELECT "org_id",
    "max_connectors",
    "max_storage_gb_est",
    "max_daily_rows",
    "max_query_runtime_ms",
    "updated_at"
   FROM "core"."organization_quotas";


ALTER VIEW "public"."organization_quotas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organizations" WITH ("security_invoker"='true') AS
 SELECT "org_id",
    "slug",
    "status",
    "created_at",
    "updated_at"
   FROM "core"."organizations";


ALTER VIEW "public"."organizations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."provisioning_workflows" WITH ("security_invoker"='true') AS
 SELECT "correlation_id",
    "org_id",
    "status",
    "md_db_name",
    "md_sa_username",
    "fivetran_destination_id",
    "metadata",
    "error_message",
    "started_at",
    "finished_at",
    "created_at",
    "updated_at"
   FROM "core"."provisioning_workflows";


ALTER VIEW "public"."provisioning_workflows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "system"."rate_limits" (
    "user_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "chk_system_rate_limits_count_nonnegative" CHECK (("count" >= 0))
);


ALTER TABLE "system"."rate_limits" OWNER TO "postgres";


COMMENT ON TABLE "system"."rate_limits" IS 'Per-user action counters for rate limiting (server-only)';



CREATE OR REPLACE VIEW "public"."rate_limits" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    "action",
    "window_start",
    "count"
   FROM "system"."rate_limits";


ALTER VIEW "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "system"."secrets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "text" NOT NULL,
    "secret_name" "text" NOT NULL,
    "secret_value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_system_secrets_secret_name_nonempty" CHECK (("length"("secret_name") > 0)),
    CONSTRAINT "chk_system_secrets_secret_value_nonempty" CHECK (("length"("secret_value") > 0))
);


ALTER TABLE "system"."secrets" OWNER TO "postgres";


COMMENT ON TABLE "system"."secrets" IS 'Secure secrets storage per organization';



CREATE OR REPLACE VIEW "public"."secrets" WITH ("security_invoker"='true') AS
 SELECT "id",
    "org_id",
    "secret_name",
    "secret_value",
    "created_at",
    "updated_at"
   FROM "system"."secrets";


ALTER VIEW "public"."secrets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_fivetran_connection_overview" WITH ("security_invoker"='true') AS
 SELECT "local_connection_id",
    "org_id",
    "source_type",
    "schema_name",
    "fivetran_connector_id",
    "connection_name",
    "official_connector_name",
    "connector_type",
    "status",
    "paused",
    "sync_frequency",
    "last_successful_sync_at",
    "deployment_type",
    "destination_name",
    "destination_region"
   FROM "connect"."v_fivetran_connection_overview";


ALTER VIEW "public"."v_fivetran_connection_overview" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_organization_overview" WITH ("security_invoker"='true') AS
 SELECT "o"."org_id",
    "o"."slug",
    "o"."status" AS "org_status",
    "o"."created_at" AS "org_created_at",
    "o"."updated_at" AS "org_updated_at",
    "dd"."id" AS "destination_id",
    "dd"."status" AS "destination_status",
    "dd"."fivetran_destination_id",
    "dd"."md_db_name",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "connect"."data_connections" "dc"
          WHERE ("dc"."org_id" = "o"."org_id")) AS "total_connections",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "connect"."data_connections" "dc"
          WHERE (("dc"."org_id" = "o"."org_id") AND ("dc"."status" = 'healthy'::"connect"."connection_status_t"))) AS "healthy_connections",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "connect"."data_connections" "dc"
          WHERE (("dc"."org_id" = "o"."org_id") AND ("dc"."status" = 'error'::"connect"."connection_status_t"))) AS "error_connections"
   FROM ("core"."organizations" "o"
     LEFT JOIN "connect"."data_destinations" "dd" ON (("dd"."org_id" = "o"."org_id")))
  WHERE ("o"."org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"));


ALTER VIEW "public"."v_organization_overview" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "system"."audit_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "system"."audit_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "system"."audit_events_id_seq" OWNED BY "system"."audit_events"."id";



ALTER TABLE ONLY "system"."audit_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"system"."audit_events_id_seq"'::"regclass");



ALTER TABLE ONLY "connect"."connector_types"
    ADD CONSTRAINT "connector_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "connect"."data_connections"
    ADD CONSTRAINT "data_connections_fivetran_connector_id_key" UNIQUE ("fivetran_connector_id");



ALTER TABLE ONLY "connect"."data_connections"
    ADD CONSTRAINT "data_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "connect"."data_destinations"
    ADD CONSTRAINT "data_destinations_fivetran_destination_id_key" UNIQUE ("fivetran_destination_id");



ALTER TABLE ONLY "connect"."data_destinations"
    ADD CONSTRAINT "data_destinations_md_db_name_key" UNIQUE ("md_db_name");



ALTER TABLE ONLY "connect"."data_destinations"
    ADD CONSTRAINT "data_destinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "connect"."data_connections"
    ADD CONSTRAINT "uq_data_connections_per_source" UNIQUE ("org_id", "source_type");



ALTER TABLE ONLY "connect"."data_destinations"
    ADD CONSTRAINT "uq_data_destinations_per_org" UNIQUE ("org_id");



ALTER TABLE ONLY "core"."organization_quotas"
    ADD CONSTRAINT "organization_quotas_pkey" PRIMARY KEY ("org_id");



ALTER TABLE ONLY "core"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("org_id");



ALTER TABLE ONLY "core"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "core"."provisioning_workflows"
    ADD CONSTRAINT "provisioning_workflows_pkey" PRIMARY KEY ("correlation_id");



ALTER TABLE ONLY "fivetran_log"."account"
    ADD CONSTRAINT "account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."audit_trail"
    ADD CONSTRAINT "audit_trail_pkey" PRIMARY KEY ("captured_at", "id");



ALTER TABLE ONLY "fivetran_log"."column_lineage"
    ADD CONSTRAINT "column_lineage_pkey" PRIMARY KEY ("destination_column_id", "source_column_id");



ALTER TABLE ONLY "fivetran_log"."connection"
    ADD CONSTRAINT "connection_pkey" PRIMARY KEY ("connection_id");



ALTER TABLE ONLY "fivetran_log"."connector_type"
    ADD CONSTRAINT "connector_type_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."destination_column_change_event"
    ADD CONSTRAINT "destination_column_change_event_pkey" PRIMARY KEY ("attribute_name", "column_id", "detected_at");



ALTER TABLE ONLY "fivetran_log"."destination_column"
    ADD CONSTRAINT "destination_column_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."destination"
    ADD CONSTRAINT "destination_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."destination_schema_change_event"
    ADD CONSTRAINT "destination_schema_change_event_pkey" PRIMARY KEY ("detected_at", "schema_id");



ALTER TABLE ONLY "fivetran_log"."destination_schema"
    ADD CONSTRAINT "destination_schema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."destination_table_change_event"
    ADD CONSTRAINT "destination_table_change_event_pkey" PRIMARY KEY ("detected_at", "table_id");



ALTER TABLE ONLY "fivetran_log"."destination_table"
    ADD CONSTRAINT "destination_table_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."incremental_mar"
    ADD CONSTRAINT "incremental_mar_pkey" PRIMARY KEY ("connection_name", "destination_id", "measured_date", "schema_name", "sync_type", "table_name", "free_type");



ALTER TABLE ONLY "fivetran_log"."log"
    ADD CONSTRAINT "log_pkey" PRIMARY KEY ("id", "time_stamp");



ALTER TABLE ONLY "fivetran_log"."resource_membership"
    ADD CONSTRAINT "resource_membership_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."role_permission"
    ADD CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id", "permission");



ALTER TABLE ONLY "fivetran_log"."role"
    ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."schema_lineage"
    ADD CONSTRAINT "schema_lineage_pkey" PRIMARY KEY ("destination_schema_id", "source_schema_id");



ALTER TABLE ONLY "fivetran_log"."source_column_change_event"
    ADD CONSTRAINT "source_column_change_event_pkey" PRIMARY KEY ("attribute_name", "column_id", "detected_at", "entity_type");



ALTER TABLE ONLY "fivetran_log"."source_column"
    ADD CONSTRAINT "source_column_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."source_schema_change_event"
    ADD CONSTRAINT "source_schema_change_event_pkey" PRIMARY KEY ("detected_at", "schema_id");



ALTER TABLE ONLY "fivetran_log"."source_schema"
    ADD CONSTRAINT "source_schema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."source_table_change_event"
    ADD CONSTRAINT "source_table_change_event_pkey" PRIMARY KEY ("detected_at", "table_id");



ALTER TABLE ONLY "fivetran_log"."source_table"
    ADD CONSTRAINT "source_table_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "fivetran_log"."table_lineage"
    ADD CONSTRAINT "table_lineage_pkey" PRIMARY KEY ("destination_table_id", "source_table_id");



ALTER TABLE ONLY "fivetran_log"."user"
    ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "system"."audit_events"
    ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "system"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "system"."rate_limits"
    ADD CONSTRAINT "pk_system_rate_limits" PRIMARY KEY ("user_id", "action", "window_start");



ALTER TABLE ONLY "system"."secrets"
    ADD CONSTRAINT "secrets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "system"."secrets"
    ADD CONSTRAINT "uq_system_secrets_org_name" UNIQUE ("org_id", "secret_name");



CREATE INDEX "idx_connector_types_label" ON "connect"."connector_types" USING "gin" ("label" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_data_connections_healthy" ON "connect"."data_connections" USING "btree" ("org_id", "updated_at" DESC) WHERE ("status" = 'healthy'::"connect"."connection_status_t");



CREATE INDEX "idx_data_connections_org_created" ON "connect"."data_connections" USING "btree" ("org_id", "created_at");



CREATE INDEX "idx_data_connections_org_status" ON "connect"."data_connections" USING "btree" ("org_id", "status");



CREATE INDEX "idx_data_destinations_org" ON "connect"."data_destinations" USING "btree" ("org_id");



CREATE INDEX "idx_data_destinations_status" ON "connect"."data_destinations" USING "btree" ("status");



CREATE INDEX "idx_organizations_created_at" ON "core"."organizations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_organizations_slug_lower" ON "core"."organizations" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_organizations_status" ON "core"."organizations" USING "btree" ("status");



CREATE INDEX "idx_provisioning_workflows_org_active" ON "core"."provisioning_workflows" USING "btree" ("org_id", "started_at" DESC) WHERE ("status" = ANY (ARRAY['pending'::"core"."provisioning_status_t", 'running'::"core"."provisioning_status_t"]));



CREATE INDEX "idx_provisioning_workflows_org_created" ON "core"."provisioning_workflows" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_provisioning_workflows_status" ON "core"."provisioning_workflows" USING "btree" ("status");



CREATE INDEX "idx_public_conversations_org" ON "public"."conversations" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_public_conversations_org_owner_updated" ON "public"."conversations" USING "btree" ("org_id", "owner_user_id", "updated_at" DESC);



CREATE INDEX "idx_public_conversations_org_updated" ON "public"."conversations" USING "btree" ("org_id", "updated_at" DESC);



CREATE INDEX "idx_public_conversations_org_updated_active" ON "public"."conversations" USING "btree" ("org_id", "updated_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_public_conversations_owner" ON "public"."conversations" USING "btree" ("owner_user_id");



CREATE INDEX "idx_public_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_public_messages_conversation_created_ok" ON "public"."messages" USING "btree" ("conversation_id", "created_at") WHERE ("error" IS NULL);



CREATE INDEX "idx_public_messages_org" ON "public"."messages" USING "btree" ("org_id");



CREATE INDEX "idx_public_messages_org_owner_created" ON "public"."messages" USING "btree" ("org_id", "owner_user_id", "created_at");



CREATE INDEX "idx_public_messages_org_role_time" ON "public"."messages" USING "btree" ("org_id", "role", "created_at" DESC);



CREATE UNIQUE INDEX "uq_public_messages_conversation_idempotency" ON "public"."messages" USING "btree" ("conversation_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_audit_events_org_correlation" ON "system"."audit_events" USING "btree" ("org_id", "correlation_id");



CREATE INDEX "idx_audit_events_org_created_on" ON "system"."audit_events" USING "btree" ("org_id", "created_on");



CREATE INDEX "idx_audit_events_org_time" ON "system"."audit_events" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_audit_events_org_type_time" ON "system"."audit_events" USING "btree" ("org_id", "type", "created_at" DESC);



CREATE INDEX "idx_audit_events_payload" ON "system"."audit_events" USING "gin" ("payload");



CREATE INDEX "idx_audit_events_type" ON "system"."audit_events" USING "btree" ("type");



CREATE INDEX "idx_audit_events_type_time" ON "system"."audit_events" USING "btree" ("type", "created_at" DESC);



CREATE INDEX "idx_system_idempotency_first_seen" ON "system"."idempotency_keys" USING "btree" ("first_seen_at" DESC);



CREATE INDEX "idx_system_idempotency_org" ON "system"."idempotency_keys" USING "btree" ("org_id");



CREATE INDEX "idx_system_secrets_name" ON "system"."secrets" USING "btree" ("secret_name");



CREATE INDEX "idx_system_secrets_org_id" ON "system"."secrets" USING "btree" ("org_id");



CREATE INDEX "idx_system_secrets_org_name" ON "system"."secrets" USING "btree" ("org_id", "secret_name");



CREATE UNIQUE INDEX "uq_audit_events_correlation_seq" ON "system"."audit_events" USING "btree" ("correlation_id", "event_seq");



CREATE UNIQUE INDEX "uq_audit_events_vendor_dedupe" ON "system"."audit_events" USING "btree" ("org_id", "provider", (("payload" ->> 'id'::"text"))) WHERE ("payload" ? 'id'::"text");



CREATE OR REPLACE TRIGGER "trg_data_connections_set_updated_at" BEFORE UPDATE ON "connect"."data_connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_data_destinations_set_updated_at" BEFORE UPDATE ON "connect"."data_destinations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_organization_quotas_set_updated_at" BEFORE UPDATE ON "core"."organization_quotas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_organizations_block_slug" BEFORE UPDATE ON "core"."organizations" FOR EACH ROW EXECUTE FUNCTION "core"."block_slug_update"();



CREATE OR REPLACE TRIGGER "trg_organizations_set_updated_at" BEFORE UPDATE ON "core"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_provisioning_workflows_set_updated_at" BEFORE UPDATE ON "core"."provisioning_workflows" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_public_conversations_set_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_public_messages_set_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_audit_events_block" BEFORE DELETE OR UPDATE ON "system"."audit_events" FOR EACH STATEMENT EXECUTE FUNCTION "public"."block_update_delete"();



CREATE OR REPLACE TRIGGER "trg_audit_events_set_created_on" BEFORE INSERT OR UPDATE OF "created_at" ON "system"."audit_events" FOR EACH ROW EXECUTE FUNCTION "system"."set_audit_events_created_on"();



CREATE OR REPLACE TRIGGER "trg_audit_events_set_seq" BEFORE INSERT ON "system"."audit_events" FOR EACH ROW EXECUTE FUNCTION "system"."set_audit_event_seq"();



CREATE OR REPLACE TRIGGER "trg_system_secrets_set_updated_at" BEFORE UPDATE ON "system"."secrets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "connect"."data_connections"
    ADD CONSTRAINT "data_connections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("org_id") ON DELETE CASCADE;



ALTER TABLE ONLY "connect"."data_destinations"
    ADD CONSTRAINT "data_destinations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("org_id") ON DELETE CASCADE;



ALTER TABLE ONLY "connect"."data_connections"
    ADD CONSTRAINT "fk_data_connections_source_type" FOREIGN KEY ("source_type") REFERENCES "connect"."connector_types"("code");



ALTER TABLE ONLY "core"."organization_quotas"
    ADD CONSTRAINT "organization_quotas_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("org_id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."provisioning_workflows"
    ADD CONSTRAINT "provisioning_workflows_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("org_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("org_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "system"."audit_events"
    ADD CONSTRAINT "audit_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("org_id") ON DELETE CASCADE;



ALTER TABLE ONLY "system"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("org_id") ON DELETE CASCADE;



ALTER TABLE ONLY "system"."secrets"
    ADD CONSTRAINT "secrets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("org_id") ON DELETE CASCADE;



ALTER TABLE "connect"."connector_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "connector_types_read_all" ON "connect"."connector_types" FOR SELECT USING (true);



ALTER TABLE "connect"."data_connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "data_connections_delete_org" ON "connect"."data_connections" FOR DELETE USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "data_connections_insert_org" ON "connect"."data_connections" FOR INSERT WITH CHECK (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "data_connections_select_org" ON "connect"."data_connections" FOR SELECT USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "data_connections_update_org" ON "connect"."data_connections" FOR UPDATE USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))) WITH CHECK (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



ALTER TABLE "connect"."data_destinations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "data_destinations_delete_service_role" ON "connect"."data_destinations" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "data_destinations_insert_service_role" ON "connect"."data_destinations" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "data_destinations_select_org" ON "connect"."data_destinations" FOR SELECT USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "data_destinations_update_service_role" ON "connect"."data_destinations" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "core"."organization_quotas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_quotas_select_org" ON "core"."organization_quotas" FOR SELECT USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



ALTER TABLE "core"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_insert_org" ON "core"."organizations" FOR INSERT WITH CHECK (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "organizations_select_org" ON "core"."organizations" FOR SELECT USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "organizations_update_org" ON "core"."organizations" FOR UPDATE USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))) WITH CHECK (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



ALTER TABLE "core"."provisioning_workflows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provisioning_workflows_delete_org" ON "core"."provisioning_workflows" FOR DELETE USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "provisioning_workflows_insert_org" ON "core"."provisioning_workflows" FOR INSERT WITH CHECK (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "provisioning_workflows_select_org" ON "core"."provisioning_workflows" FOR SELECT USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "provisioning_workflows_update_org" ON "core"."provisioning_workflows" FOR UPDATE USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))) WITH CHECK (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_conversations_delete_own" ON "public"."conversations" FOR DELETE USING ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))));



CREATE POLICY "public_conversations_insert_self" ON "public"."conversations" FOR INSERT WITH CHECK ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))));



CREATE POLICY "public_conversations_select_own" ON "public"."conversations" FOR SELECT USING ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))));



CREATE POLICY "public_conversations_update_own" ON "public"."conversations" FOR UPDATE USING ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")))) WITH CHECK ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))));



CREATE POLICY "public_messages_delete_own" ON "public"."messages" FOR DELETE USING ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("c"."org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")))))));



CREATE POLICY "public_messages_insert_own" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("c"."org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))))));



CREATE POLICY "public_messages_select_own" ON "public"."messages" FOR SELECT USING ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("c"."org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")))))));



CREATE POLICY "public_messages_update_own" ON "public"."messages" FOR UPDATE USING ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("c"."org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))))))) WITH CHECK ((("owner_user_id" = ( SELECT "public"."jwt_claim"('sub'::"text") AS "jwt_claim")) AND ("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim"))));



CREATE POLICY "Deny all other access" ON "system"."secrets" AS RESTRICTIVE USING (false);



CREATE POLICY "Service role only" ON "system"."secrets" TO "service_role" USING (true);



ALTER TABLE "system"."audit_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_events_insert_org" ON "system"."audit_events" FOR INSERT WITH CHECK (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



CREATE POLICY "audit_events_select_org" ON "system"."audit_events" FOR SELECT USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



ALTER TABLE "system"."idempotency_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "idempotency_keys_select_org" ON "system"."idempotency_keys" FOR SELECT USING (("org_id" = ( SELECT "public"."jwt_claim"('org_id'::"text") AS "jwt_claim")));



ALTER TABLE "system"."rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_limits_select_none" ON "system"."rate_limits" FOR SELECT USING (false);



ALTER TABLE "system"."secrets" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "clerk" TO "service_role";



GRANT USAGE ON SCHEMA "connect" TO "authenticated";
GRANT USAGE ON SCHEMA "connect" TO "service_role";



GRANT USAGE ON SCHEMA "core" TO "authenticated";
GRANT USAGE ON SCHEMA "core" TO "service_role";



GRANT USAGE ON SCHEMA "fivetran_log" TO "authenticated";
GRANT USAGE ON SCHEMA "fivetran_log" TO "service_role";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "system" TO "authenticated";
GRANT USAGE ON SCHEMA "system" TO "service_role";



GRANT ALL ON TYPE "connect"."connection_status_t" TO "authenticated";
GRANT ALL ON TYPE "connect"."connection_status_t" TO "service_role";



GRANT ALL ON TYPE "connect"."destination_status_t" TO "authenticated";
GRANT ALL ON TYPE "connect"."destination_status_t" TO "service_role";



GRANT ALL ON TYPE "core"."organization_status_t" TO "authenticated";
GRANT ALL ON TYPE "core"."organization_status_t" TO "service_role";



GRANT ALL ON TYPE "core"."provisioning_status_t" TO "authenticated";
GRANT ALL ON TYPE "core"."provisioning_status_t" TO "service_role";









GRANT ALL ON FUNCTION "core"."block_slug_update"() TO "service_role";





























































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."block_update_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_jwt"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."ensure_tenant_exists"("p_org_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_tenant_exists"("p_org_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_from_clerk_mirror"("p_org_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_from_clerk_mirror"("p_org_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_secret"("p_org_id" "text", "p_secret_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."jwt_claim"("claim" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jwt_claim"("claim" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_append_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "jsonb", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_append_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "jsonb", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_secret"("p_org_id" "text", "p_secret_name" "text", "p_secret_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "system"."delete_secret"("p_org_id" "text", "p_secret_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "system"."delete_secret"("p_org_id" "text", "p_secret_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "system"."get_md_sa_token"("p_org_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "system"."get_md_sa_token"("p_org_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "system"."get_secret"("p_org_id" "text", "p_secret_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "system"."get_secret"("p_org_id" "text", "p_secret_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "system"."has_secret"("p_org_id" "text", "p_secret_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "system"."has_secret"("p_org_id" "text", "p_secret_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "system"."rate_limit_check"("p_user_id" "text", "p_action" "text", "p_window" interval, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "system"."rate_limit_check"("p_user_id" "text", "p_action" "text", "p_window" interval, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "system"."set_audit_event_seq"() TO "service_role";



GRANT ALL ON FUNCTION "system"."set_audit_events_created_on"() TO "service_role";



REVOKE ALL ON FUNCTION "system"."set_md_sa_token"("p_org_id" "text", "p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "system"."set_md_sa_token"("p_org_id" "text", "p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "system"."set_secret"("p_org_id" "text", "p_secret_name" "text", "p_secret_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "system"."set_secret"("p_org_id" "text", "p_secret_name" "text", "p_secret_value" "text") TO "service_role";












GRANT ALL ON FOREIGN SERVER "clerk_server" TO "service_role";



GRANT SELECT ON TABLE "clerk"."allowlist_identifiers" TO "service_role";



GRANT SELECT ON TABLE "clerk"."blocklist_identifiers" TO "service_role";



GRANT SELECT ON TABLE "clerk"."domains" TO "service_role";



GRANT SELECT ON TABLE "clerk"."invitations" TO "service_role";



GRANT SELECT ON TABLE "clerk"."jwt_templates" TO "service_role";



GRANT SELECT ON TABLE "clerk"."oauth_applications" TO "service_role";



GRANT SELECT ON TABLE "clerk"."organization_invitations" TO "service_role";



GRANT SELECT ON TABLE "clerk"."organization_memberships" TO "service_role";



GRANT SELECT ON TABLE "clerk"."organizations" TO "service_role";



GRANT SELECT ON TABLE "clerk"."redirect_urls" TO "service_role";



GRANT SELECT ON TABLE "clerk"."saml_connections" TO "service_role";



GRANT SELECT ON TABLE "clerk"."users" TO "service_role";



GRANT SELECT ON TABLE "connect"."connector_types" TO "authenticated";
GRANT ALL ON TABLE "connect"."connector_types" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "connect"."data_connections" TO "authenticated";
GRANT ALL ON TABLE "connect"."data_connections" TO "service_role";



GRANT SELECT ON TABLE "connect"."data_destinations" TO "authenticated";
GRANT ALL ON TABLE "connect"."data_destinations" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."connection" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."connection" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."connector_type" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."connector_type" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."destination" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."destination" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."log" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."log" TO "service_role";



GRANT SELECT ON TABLE "connect"."v_fivetran_connection_overview" TO "authenticated";
GRANT ALL ON TABLE "connect"."v_fivetran_connection_overview" TO "service_role";



GRANT SELECT ON TABLE "core"."organization_quotas" TO "authenticated";
GRANT ALL ON TABLE "core"."organization_quotas" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "core"."organizations" TO "authenticated";
GRANT ALL ON TABLE "core"."organizations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."provisioning_workflows" TO "authenticated";
GRANT ALL ON TABLE "core"."provisioning_workflows" TO "service_role";












GRANT SELECT ON TABLE "fivetran_log"."account" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."account" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."audit_trail" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."audit_trail" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."column_lineage" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."column_lineage" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."destination_column" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."destination_column" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."destination_column_change_event" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."destination_column_change_event" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."destination_schema" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."destination_schema" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."destination_schema_change_event" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."destination_schema_change_event" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."destination_table" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."destination_table" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."destination_table_change_event" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."destination_table_change_event" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."incremental_mar" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."incremental_mar" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."resource_membership" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."resource_membership" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."role" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."role" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."role_permission" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."role_permission" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."schema_lineage" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."schema_lineage" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."source_column" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."source_column" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."source_column_change_event" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."source_column_change_event" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."source_schema" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."source_schema" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."source_schema_change_event" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."source_schema_change_event" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."source_table" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."source_table" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."source_table_change_event" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."source_table_change_event" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."table_lineage" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."table_lineage" TO "service_role";



GRANT SELECT ON TABLE "fivetran_log"."user" TO "authenticated";
GRANT SELECT ON TABLE "fivetran_log"."user" TO "service_role";



GRANT SELECT,INSERT ON TABLE "system"."audit_events" TO "authenticated";
GRANT ALL ON TABLE "system"."audit_events" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_events" TO "service_role";



GRANT SELECT ON TABLE "public"."connector_types" TO "authenticated";
GRANT ALL ON TABLE "public"."connector_types" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."data_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."data_connections" TO "service_role";



GRANT SELECT ON TABLE "public"."data_destinations" TO "authenticated";
GRANT ALL ON TABLE "public"."data_destinations" TO "service_role";



GRANT SELECT ON TABLE "system"."idempotency_keys" TO "authenticated";
GRANT ALL ON TABLE "system"."idempotency_keys" TO "service_role";



GRANT SELECT ON TABLE "public"."idempotency_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT SELECT ON TABLE "public"."organization_quotas" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_quotas" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."provisioning_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."provisioning_workflows" TO "service_role";



GRANT ALL ON TABLE "system"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "system"."secrets" TO "service_role";



GRANT ALL ON TABLE "public"."secrets" TO "service_role";



GRANT SELECT ON TABLE "public"."v_fivetran_connection_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."v_fivetran_connection_overview" TO "service_role";



GRANT SELECT ON TABLE "public"."v_organization_overview" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_organization_overview" TO "anon";
GRANT ALL ON TABLE "public"."v_organization_overview" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "system"."audit_events_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "system"."audit_events_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "clerk" GRANT SELECT ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "fivetran_log" GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "fivetran_log" GRANT SELECT ON TABLES TO "service_role";




























RESET ALL;

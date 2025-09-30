-- Core extensions and helper utilities shared across the application.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.jwt_claim(claim text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce((current_setting('request.jwt.claims', true))::jsonb ->> claim, NULL);
$$;
ALTER FUNCTION public.jwt_claim(text) SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id');
$$;
ALTER FUNCTION public.current_org_id() SET search_path = pg_catalog, public;

-- Legacy vault functions - now redirect to secure secrets table
-- These functions maintain backward compatibility while using the new secure approach

CREATE OR REPLACE FUNCTION public._vault_available()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Always return true since we now use the secure secrets table
  SELECT true;
$$;

ALTER FUNCTION public._vault_available()
  SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.vault_set(p_name text, p_secret text)
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

  -- Use the secure secrets table
  PERFORM public.set_service_secret(org_id, secret_name, p_secret);
END;
$$;

ALTER FUNCTION public.vault_set(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.vault_set(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_set(text, text) TO service_role;

-- Legacy vault_get_secret function for backward compatibility
CREATE OR REPLACE FUNCTION public.vault_get_secret(p_name text)
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

  -- Use the secure secrets table
  SELECT public.get_service_secret(org_id, secret_name) INTO secret_value;
  RETURN secret_value;
END;
$$;

ALTER FUNCTION public.vault_get_secret(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.vault_get_secret(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_get_secret(text) TO service_role;

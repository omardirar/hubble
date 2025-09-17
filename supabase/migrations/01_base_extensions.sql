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

CREATE OR REPLACE FUNCTION public._vault_available()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'vault'
      AND installed_version IS NOT NULL
  );
$$;

ALTER FUNCTION public._vault_available()
  SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.vault_set(p_name text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public._vault_available() THEN
    RAISE EXCEPTION 'Supabase Vault is not enabled in this environment.' USING errcode = 'P0001';
  END IF;

  INSERT INTO vault.secrets(name, secret)
  VALUES (p_name, p_secret)
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
END;
$$;

ALTER FUNCTION public.vault_set(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.vault_set(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_set(text, text) TO service_role;

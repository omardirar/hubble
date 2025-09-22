-- Secure secrets table to replace Supabase Vault functionality
-- This provides a more reliable and secure approach for storing sensitive data

-- Create the service_secrets table
CREATE TABLE IF NOT EXISTS public.service_secrets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL,
  secret_name TEXT NOT NULL,
  secret_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, secret_name)
);

-- Enable RLS
ALTER TABLE public.service_secrets ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_secrets_org_id ON public.service_secrets (org_id);
CREATE INDEX IF NOT EXISTS idx_service_secrets_name ON public.service_secrets (secret_name);
CREATE INDEX IF NOT EXISTS idx_service_secrets_org_name ON public.service_secrets (org_id, secret_name);

-- RLS Policies - Only service role can access secrets
CREATE POLICY "Service role only" ON public.service_secrets
  FOR ALL TO service_role USING (true);

-- Deny all other access
CREATE POLICY "Deny all other access" ON public.service_secrets
  AS RESTRICTIVE TO public USING (false);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS trg_service_secrets_set_updated_at ON public.service_secrets;
CREATE TRIGGER trg_service_secrets_set_updated_at
  BEFORE UPDATE ON public.service_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create secure functions for secret management
CREATE OR REPLACE FUNCTION public.set_service_secret(
  p_org_id TEXT,
  p_secret_name TEXT,
  p_secret_value TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
  INSERT INTO public.service_secrets (org_id, secret_name, secret_value)
  VALUES (p_org_id, p_secret_name, p_secret_value)
  ON CONFLICT (org_id, secret_name)
  DO UPDATE SET
    secret_value = EXCLUDED.secret_value,
    updated_at = NOW();
END;
$$;

-- Grant execute permission only to service role
ALTER FUNCTION public.set_service_secret(TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_service_secret(TEXT, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_service_secret(TEXT, TEXT, TEXT) TO service_role;

-- Create function to get service secret
CREATE OR REPLACE FUNCTION public.get_service_secret(
  p_org_id TEXT,
  p_secret_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
  FROM public.service_secrets s
  WHERE s.org_id = p_org_id
    AND s.secret_name = p_secret_name;

  -- Return the secret or null if not found
  RETURN secret_value;
END;
$$;

-- Grant execute permission only to service role
ALTER FUNCTION public.get_service_secret(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_service_secret(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_service_secret(TEXT, TEXT) TO service_role;

-- Create function to check if secret exists
CREATE OR REPLACE FUNCTION public.has_service_secret(
  p_org_id TEXT,
  p_secret_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
    FROM public.service_secrets s
    WHERE s.org_id = p_org_id
      AND s.secret_name = p_secret_name
  ) INTO secret_exists;

  RETURN secret_exists;
END;
$$;

-- Grant execute permission only to service role
ALTER FUNCTION public.has_service_secret(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_service_secret(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_service_secret(TEXT, TEXT) TO service_role;

-- Create function to delete service secret
CREATE OR REPLACE FUNCTION public.delete_service_secret(
  p_org_id TEXT,
  p_secret_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
  DELETE FROM public.service_secrets
  WHERE org_id = p_org_id
    AND secret_name = p_secret_name;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- Grant execute permission only to service role
ALTER FUNCTION public.delete_service_secret(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.delete_service_secret(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_service_secret(TEXT, TEXT) TO service_role;

-- Create convenience function for MotherDuck SA tokens
CREATE OR REPLACE FUNCTION public.get_md_sa_token(p_org_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN public.get_service_secret(p_org_id, 'md_sa_token');
END;
$$;

-- Grant execute permission only to service role
ALTER FUNCTION public.get_md_sa_token(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_md_sa_token(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_md_sa_token(TEXT) TO service_role;

-- Create convenience function to set MotherDuck SA tokens
CREATE OR REPLACE FUNCTION public.set_md_sa_token(p_org_id TEXT, p_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.set_service_secret(p_org_id, 'md_sa_token', p_token);
END;
$$;

-- Grant execute permission only to service role
ALTER FUNCTION public.set_md_sa_token(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_md_sa_token(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_md_sa_token(TEXT, TEXT) TO service_role;

-- Create tenant_provisioning table with proper structure
-- This migration creates the tenant_provisioning table with the correct schema
-- including the metadata column and proper enum values

-- First, ensure the enum values exist
ALTER TYPE tenant_status_t ADD VALUE IF NOT EXISTS 'running';
ALTER TYPE tenant_status_t ADD VALUE IF NOT EXISTS 'failed';

-- Create the tenant_provisioning table with the correct structure
CREATE TABLE IF NOT EXISTS public.tenant_provisioning (
  org_id     text primary key,
  slug       text unique not null,
  status     tenant_status_t not null default 'running',
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure metadata column exists (in case table was created without it)
ALTER TABLE public.tenant_provisioning ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Update any existing rows that might have NULL metadata
UPDATE public.tenant_provisioning SET metadata = '{}'::jsonb WHERE metadata IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS tenant_provisioning_slug_lower_idx ON public.tenant_provisioning (lower(slug));

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tenant_provisioning_org_status ON public.tenant_provisioning(org_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_provisioning_org_updated ON public.tenant_provisioning(org_id, updated_at);

-- Migrate data from tenants table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    -- Insert data from tenants table, converting 'provisioning' to 'running'
    INSERT INTO public.tenant_provisioning (org_id, slug, status, created_at, updated_at)
    SELECT
      org_id,
      slug,
      CASE
        WHEN status = 'provisioning' THEN 'running'::tenant_status_t
        ELSE status::tenant_status_t
      END,
      created_at,
      updated_at
    FROM public.tenants
    ON CONFLICT (org_id) DO UPDATE SET
      slug = EXCLUDED.slug,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;

    RAISE NOTICE 'Migrated data from tenants table to tenant_provisioning';
  ELSE
    RAISE NOTICE 'No tenants table found, skipping data migration';
  END IF;
END$$;

-- Update foreign key constraints to reference the new table
ALTER TABLE public.tenant_destinations DROP CONSTRAINT IF EXISTS tenant_destinations_org_id_fkey;
ALTER TABLE public.tenant_destinations ADD CONSTRAINT tenant_destinations_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.tenant_provisioning(org_id) ON DELETE CASCADE;

ALTER TABLE public.provisioning_runs DROP CONSTRAINT IF EXISTS provisioning_runs_org_id_fkey;
ALTER TABLE public.provisioning_runs ADD CONSTRAINT provisioning_runs_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.tenant_provisioning(org_id) ON DELETE CASCADE;

-- Create RLS policies
ALTER TABLE public.tenant_provisioning ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_provisioning_select_org ON public.tenant_provisioning;
CREATE POLICY tenant_provisioning_select_org
  ON public.tenant_provisioning FOR SELECT
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS tenant_provisioning_insert_org ON public.tenant_provisioning;
CREATE POLICY tenant_provisioning_insert_org
  ON public.tenant_provisioning FOR INSERT
  WITH CHECK (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS tenant_provisioning_update_org ON public.tenant_provisioning;
CREATE POLICY tenant_provisioning_update_org
  ON public.tenant_provisioning FOR UPDATE
  USING (org_id = (SELECT public.current_org_id()))
  WITH CHECK (org_id = (SELECT public.current_org_id()));

-- Create triggers
DROP TRIGGER IF EXISTS trg_tenant_provisioning_block_slug ON public.tenant_provisioning;
CREATE TRIGGER trg_tenant_provisioning_block_slug
BEFORE UPDATE ON public.tenant_provisioning
FOR EACH ROW EXECUTE FUNCTION public.block_slug_update();

DROP TRIGGER IF EXISTS trg_tenant_provisioning_set_updated_at ON public.tenant_provisioning;
CREATE TRIGGER trg_tenant_provisioning_set_updated_at
BEFORE UPDATE ON public.tenant_provisioning
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grant permissions
GRANT INSERT ON TABLE public.tenant_provisioning TO authenticated;
GRANT UPDATE ON TABLE public.tenant_provisioning TO authenticated;
GRANT SELECT ON TABLE public.tenant_provisioning TO authenticated;
GRANT INSERT ON TABLE public.tenant_provisioning TO service_role;
GRANT UPDATE ON TABLE public.tenant_provisioning TO service_role;
GRANT SELECT ON TABLE public.tenant_provisioning TO service_role;

-- Update functions to use the new table
CREATE OR REPLACE FUNCTION ensure_tenant_exists(p_org_id text)
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
  IF EXISTS (SELECT 1 FROM public.tenant_provisioning WHERE org_id = p_org_id) THEN
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
      INSERT INTO public.tenant_provisioning (org_id, slug, status)
      SELECT
        o.id,
        coalesce(nullif(trim(o.slug), ''''), o.id),
        ''running''::tenant_status_t
      FROM %I.organizations o
      WHERE o.id = $1
      ON CONFLICT (org_id) DO UPDATE
        SET slug = excluded.slug', v_schema_name)
    USING p_org_id;

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;

    IF v_rowcount = 0 THEN
      RAISE EXCEPTION 'Tenant % not found in Clerk', p_org_id USING errcode = 'P0001';
    END IF;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE EXCEPTION 'Clerk FDW not available to sync tenant %', p_org_id USING errcode = 'P0001';
    WHEN OTHERS THEN
      v_error_message := SQLERRM;
      RAISE EXCEPTION 'Failed to create tenant %: %', p_org_id, v_error_message USING errcode = 'P0002';
  END;
END;
$$;

CREATE OR REPLACE FUNCTION sync_clerk_organizations_into_tenants()
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

  -- Insert tenants from the appropriate schema
  EXECUTE format('
    INSERT INTO public.tenant_provisioning (org_id, slug, status)
    SELECT
      o.id,
      coalesce(nullif(trim(o.slug), ''''), o.id),
      ''running''::tenant_status_t
    FROM %I.organizations o
    ON CONFLICT (org_id) DO UPDATE
      SET slug = excluded.slug', v_schema_name);
END;
$$;

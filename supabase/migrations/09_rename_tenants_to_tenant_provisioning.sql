-- Rename tenants table to tenant_provisioning and update status tracking
-- This migration renames the tenants table to tenant_provisioning and updates
-- the status tracking for better provisioning visibility.

-- First, ensure the enum values exist (they should be added in the previous migration)
-- If they don't exist, this migration will fail, which is the intended behavior
DO $$
BEGIN
  -- Check if the enum values exist, if not, this migration should not run
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'running' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tenant_status_t')) THEN
    RAISE EXCEPTION 'Enum value "running" does not exist. Please run the previous migration first.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'failed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tenant_status_t')) THEN
    RAISE EXCEPTION 'Enum value "failed" does not exist. Please run the previous migration first.';
  END IF;
END$$;

-- Rename the tenants table to tenant_provisioning
ALTER TABLE public.tenants RENAME TO tenant_provisioning;

-- Update the default status to 'running' instead of 'provisioning'
ALTER TABLE public.tenant_provisioning ALTER COLUMN status SET DEFAULT 'running';

-- Update existing 'provisioning' status to 'running' for consistency
UPDATE public.tenant_provisioning SET status = 'running' WHERE status = 'provisioning';

-- Update all references to the old table name in foreign key constraints
ALTER TABLE public.tenant_destinations DROP CONSTRAINT IF EXISTS tenant_destinations_org_id_fkey;
ALTER TABLE public.tenant_destinations ADD CONSTRAINT tenant_destinations_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.tenant_provisioning(org_id) ON DELETE CASCADE;

ALTER TABLE public.provisioning_runs DROP CONSTRAINT IF EXISTS provisioning_runs_org_id_fkey;
ALTER TABLE public.provisioning_runs ADD CONSTRAINT provisioning_runs_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.tenant_provisioning(org_id) ON DELETE CASCADE;

-- Update RLS policies to reference the new table name
DROP POLICY IF EXISTS tenants_select_org ON public.tenant_provisioning;
CREATE POLICY tenant_provisioning_select_org
  ON public.tenant_provisioning FOR SELECT
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS tenants_insert_org ON public.tenant_provisioning;
CREATE POLICY tenant_provisioning_insert_org
  ON public.tenant_provisioning FOR INSERT
  WITH CHECK (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS tenants_update_org ON public.tenant_provisioning;
CREATE POLICY tenant_provisioning_update_org
  ON public.tenant_provisioning FOR UPDATE
  USING (org_id = (SELECT public.current_org_id()))
  WITH CHECK (org_id = (SELECT public.current_org_id()));

-- Update the ensure_tenant_exists function to use the new table name
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
  -- In development/preview, use clerk_dev; otherwise use clerk
  -- Default to clerk_dev if environment is not set (for development)
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

-- Update the sync_clerk_organizations_into_tenants function
CREATE OR REPLACE FUNCTION sync_clerk_organizations_into_tenants()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_schema_name text;
BEGIN
  -- Determine schema based on environment
  -- In development/preview, use clerk_dev; otherwise use clerk
  -- Default to clerk_dev if environment is not set (for development)
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

-- Update grants to reference the new table name
GRANT INSERT ON TABLE public.tenant_provisioning TO authenticated;
GRANT UPDATE ON TABLE public.tenant_provisioning TO authenticated;
GRANT SELECT ON TABLE public.tenant_provisioning TO authenticated;

-- Update indexes to reference the new table name
DROP INDEX IF EXISTS tenants_slug_lower_idx;
CREATE INDEX IF NOT EXISTS tenant_provisioning_slug_lower_idx ON public.tenant_provisioning (lower(slug));

-- Update triggers to reference the new table name
DROP TRIGGER IF EXISTS trg_tenants_block_slug ON public.tenant_provisioning;
CREATE TRIGGER trg_tenant_provisioning_block_slug
BEFORE UPDATE ON public.tenant_provisioning
FOR EACH ROW EXECUTE FUNCTION public.block_slug_update();

DROP TRIGGER IF EXISTS trg_tenants_set_updated_at ON public.tenant_provisioning;
CREATE TRIGGER trg_tenant_provisioning_set_updated_at
BEFORE UPDATE ON public.tenant_provisioning
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

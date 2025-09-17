-- Connect feature schema: tenants, provisioning runs, destinations, and events.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status_t') THEN
    CREATE TYPE run_status_t AS ENUM ('pending','running','ready','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dest_status_t') THEN
    CREATE TYPE dest_status_t AS ENUM ('pending','healthy','unhealthy');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status_t') THEN
    CREATE TYPE tenant_status_t AS ENUM ('provisioning','ready','suspended','failed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.tenants (
  org_id     text primary key,
  slug       text unique not null,
  status     tenant_status_t not null default 'provisioning',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS tenants_slug_lower_idx ON public.tenants (lower(slug));

CREATE OR REPLACE FUNCTION public.block_slug_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'slug updates are not allowed; create a new tenant instead';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.block_slug_update() SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS trg_tenants_block_slug ON public.tenants;
CREATE TRIGGER trg_tenants_block_slug
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.block_slug_update();

DROP TRIGGER IF EXISTS trg_tenants_set_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_set_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.tenant_destinations (
  id                      uuid primary key default extensions.gen_random_uuid(),
  org_id                  text not null references public.tenants(org_id) on delete cascade,
  md_db_name              text not null unique,
  md_token_ref            text not null,
  fivetran_destination_id text unique,
  status                  dest_status_t not null default 'pending',
  last_event_at           timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_dest_org ON public.tenant_destinations (org_id);

DROP TRIGGER IF EXISTS trg_dest_set_updated_at ON public.tenant_destinations;
CREATE TRIGGER trg_dest_set_updated_at
BEFORE UPDATE ON public.tenant_destinations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.provisioning_runs (
  correlation_id          text primary key default (extensions.gen_random_uuid())::text,
  org_id                  text not null references public.tenants(org_id) on delete cascade,
  status                  run_status_t not null default 'pending',
  md_db_name              text,
  md_sa_username          text,
  fivetran_destination_id text,
  metadata                jsonb not null default '{}'::jsonb,
  started_at              timestamptz not null default now(),
  finished_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_runs_org_created ON public.provisioning_runs (org_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_runs_status       ON public.provisioning_runs (status);
CREATE INDEX IF NOT EXISTS idx_runs_org_active   ON public.provisioning_runs (org_id, started_at desc)
  WHERE status IN ('pending','running');

DROP TRIGGER IF EXISTS trg_runs_set_updated_at ON public.provisioning_runs;
CREATE TRIGGER trg_runs_set_updated_at
BEFORE UPDATE ON public.provisioning_runs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.events (
  id             bigserial primary key,
  event_seq      bigint not null,
  org_id         text not null,
  provider       text not null,
  type           text not null,
  correlation_id text,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  created_on     date not null default (now() at time zone 'UTC')::date
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_events_corr_seq ON public.events (correlation_id, event_seq);
CREATE INDEX IF NOT EXISTS idx_events_org_corr ON public.events (org_id, correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_type     ON public.events (type);
CREATE INDEX IF NOT EXISTS idx_events_payload  ON public.events USING gin (payload);

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_provider_nonempty,
  DROP CONSTRAINT IF EXISTS events_type_nonempty;

ALTER TABLE public.events
  ADD CONSTRAINT events_provider_nonempty CHECK (length(provider) > 0),
  ADD CONSTRAINT events_type_nonempty     CHECK (length(type) > 0);

CREATE OR REPLACE FUNCTION public.block_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END;
$$;
ALTER FUNCTION public.block_update_delete() SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS trg_events_block ON public.events;
CREATE TRIGGER trg_events_block
BEFORE UPDATE OR DELETE ON public.events
FOR EACH STATEMENT EXECUTE FUNCTION public.block_update_delete();

-- Assign monotonically increasing event_seq per correlation_id on insert.
CREATE OR REPLACE FUNCTION public.set_event_seq()
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
    FROM public.events e
    WHERE e.correlation_id = NEW.correlation_id;
    NEW.event_seq := v_next;
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION public.set_event_seq() SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS trg_events_set_seq ON public.events;
CREATE TRIGGER trg_events_set_seq
BEFORE INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_event_seq();

ALTER TABLE public.tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events              ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select_org ON public.tenants;
CREATE POLICY tenants_select_org
  ON public.tenants FOR SELECT
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS dest_select_org ON public.tenant_destinations;
CREATE POLICY dest_select_org
  ON public.tenant_destinations FOR SELECT
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS runs_select_org ON public.provisioning_runs;
CREATE POLICY runs_select_org
  ON public.provisioning_runs FOR SELECT
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS events_select_org ON public.events;
CREATE POLICY events_select_org
  ON public.events FOR SELECT
  USING (org_id = (SELECT public.current_org_id()));

-- Helper to mirror Clerk organizations into tenants when using the FDW.
CREATE OR REPLACE FUNCTION sync_clerk_organizations_into_tenants()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.tenants (org_id, slug, status)
  SELECT
    o.id,
    coalesce(nullif(trim(o.slug), ''), o.id),
    'provisioning'
  FROM clerk.organizations o
  ON CONFLICT (org_id) DO UPDATE
    SET slug = excluded.slug;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_tenant_exists(p_org_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rowcount integer;
  v_error_message text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tenants WHERE org_id = p_org_id) THEN
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.tenants (org_id, slug, status)
    SELECT
      o.id,
      coalesce(nullif(trim(o.slug), ''), o.id),
      'provisioning'
    FROM clerk.organizations o
    WHERE o.id = p_org_id
    ON CONFLICT (org_id) DO UPDATE
      SET slug = excluded.slug;

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

-- Set function ownership to postgres for SECURITY DEFINER execution
ALTER FUNCTION public.ensure_tenant_exists(text) OWNER TO postgres;

-- Ensure postgres user has necessary schema privileges for SECURITY DEFINER function
GRANT USAGE, CREATE ON SCHEMA public TO postgres;

-- RPC grants to ensure accessibility via PostgREST
GRANT EXECUTE ON FUNCTION public.ensure_tenant_exists(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_clerk_organizations_into_tenants() TO service_role;

-- Add RLS policies for tenants table
DROP POLICY IF EXISTS tenants_insert_org ON public.tenants;
CREATE POLICY tenants_insert_org
  ON public.tenants FOR INSERT
  WITH CHECK (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS tenants_update_org ON public.tenants;
CREATE POLICY tenants_update_org
  ON public.tenants FOR UPDATE
  USING (org_id = (SELECT public.current_org_id()))
  WITH CHECK (org_id = (SELECT public.current_org_id()));

-- Grant necessary permissions for tenant operations
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT ON TABLE public.tenants TO authenticated;
GRANT UPDATE ON TABLE public.tenants TO authenticated;

-- Ensure a single destination row per tenant for upserts
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dest_org ON public.tenant_destinations(org_id);

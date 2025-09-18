-- =============================================================================
-- Unified database schema dump — Connect, Clerk mirror, Chat (idempotent)
-- Order: connect → clerk → chat (functions/types → tables → indexes/triggers → RLS → views)
-- =============================================================================

-- =============================================================================
-- [connect/00_extensions.sql]
-- =============================================================================
create schema if not exists extensions;

create extension if not exists pg_trgm with schema extensions;
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'public'
  ) then
    alter extension pg_trgm set schema extensions;
  end if;
end$$;

create extension if not exists pgcrypto with schema extensions;
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'public'
  ) then
    alter extension pgcrypto set schema extensions;
  end if;
end$$;

-- Vault setter helper (SECURITY DEFINER) for server role to upsert a secret by name
create or replace function public.vault_set(p_name text, p_secret text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public._vault_available() then
    raise exception 'Supabase Vault is not enabled in this environment. Enable it in Dashboard → Database → Extensions.' using errcode = 'P0001';
  end if;
  insert into vault.secrets(name, secret)
  values (p_name, p_secret)
  on conflict (name) do update set secret = excluded.secret;
end;
$$;

alter function public.vault_set(text, text) owner to postgres;
revoke all on function public.vault_set(text, text) from public, anon, authenticated;
grant execute on function public.vault_set(text, text) to service_role;

-- enable supabase vault extension if available (hosted projects enable via dashboard)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'vault') then
    execute 'create extension if not exists vault';
  end if;
end$$;

-- Helper to check if Vault is available/installed
create or replace function public._vault_available()
returns boolean language sql stable as
$$
  select exists (
    select 1
    from pg_available_extensions
    where name = 'vault'
      and installed_version is not null
  );
$$;

alter function public._vault_available()
  set search_path = pg_catalog, public;

-- Removed: auth.role() helper (no writes to auth schema)

-- =============================================================================
-- [connect/01_functions.sql]
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;
alter function public.set_updated_at() set search_path = pg_catalog, public;

create or replace function public.jwt_claim(claim text)
returns text
language sql
stable
as $fn$
  select coalesce((current_setting('request.jwt.claims', true))::jsonb ->> claim, null)
$fn$;
alter function public.jwt_claim(text) set search_path = pg_catalog, public;

create or replace function public.current_org_id()
returns text
language sql
stable
as $fn$
  select coalesce(
    auth.jwt()->>'org_id',
    auth.jwt()->'o'->>'id'
  )
$fn$;
alter function public.current_org_id() set search_path = pg_catalog, public;

create or replace function public.block_update_delete()
returns trigger
language plpgsql
as $fn$
begin
  if TG_OP in ('UPDATE','DELETE') then
    raise exception '% is append-only', TG_TABLE_NAME;
  end if;
  return null;
end
$fn$;
alter function public.block_update_delete() set search_path = pg_catalog, public;

create or replace function public.block_org_id_change()
returns trigger
language plpgsql
as $fn$
begin
  if TG_OP = 'UPDATE' and new.org_id is distinct from old.org_id then
    raise exception 'org_id is immutable';
  end if;
  return new;
end
$fn$;
alter function public.block_org_id_change() set search_path = pg_catalog, public;

create or replace function public.lowercase_slug()
returns trigger
language plpgsql
as $fn$
begin
  if new.slug is not null then
    new.slug := lower(new.slug);
  end if;
  return new;
end
$fn$;
alter function public.lowercase_slug() set search_path = pg_catalog, public;

create or replace function public.block_slug_update()
returns trigger
language plpgsql
as $fn$
begin
  if TG_OP = 'UPDATE' and new.slug is distinct from old.slug then
    raise exception 'slug updates are not allowed; create a new tenant instead';
  end if;
  return new;
end
$fn$;
alter function public.block_slug_update() set search_path = pg_catalog, public;

create or replace function public.set_events_created_on()
returns trigger
language plpgsql
as $fn$
begin
  new.created_on := (coalesce(new.created_at, now()) at time zone 'UTC')::date;
  return new;
end
$fn$;
alter function public.set_events_created_on() set search_path = pg_catalog, public;

-- =============================================================================
-- [connect/02_types.sql]
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tenant_status_t') then
    create type tenant_status_t as enum ('provisioning','ready','suspended','failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'dest_status_t') then
    create type dest_status_t as enum ('pending','healthy','unhealthy');
  end if;
  if not exists (select 1 from pg_type where typname = 'conn_status_t') then
    create type conn_status_t as enum ('not_configured','needs_auth','syncing','healthy','paused','error');
  end if;
end$$;

-- =============================================================================
-- [connect/03_tables.sql]
-- =============================================================================
create table if not exists public.tenants (
  org_id     text primary key,
  slug       text unique,
  status     tenant_status_t not null default 'provisioning',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenants alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tenants'::regclass and conname = 'tenants_slug_format_chk'
  ) then
    alter table public.tenants
      add constraint tenants_slug_format_chk
      check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$');
  end if;
end$$;

create index if not exists tenants_slug_lower_idx on public.tenants (lower(slug));

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='public.tenants'::regclass and conname='tenants_slug_key' and not condeferrable
  ) then
    alter table public.tenants drop constraint tenants_slug_key;
    alter table public.tenants add constraint tenants_slug_key unique (slug) deferrable initially immediate;
  end if;
end$$;

create table if not exists public.tenant_destinations (
  id                        uuid primary key default extensions.gen_random_uuid(),
  org_id                    text not null references public.tenants(org_id) on delete cascade,
  md_db_name                text not null unique,
  md_token_ref              text not null,
  fivetran_destination_id   text unique,
  status                    dest_status_t not null default 'pending',
  last_event_at             timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint uq_dest_per_org unique (org_id) deferrable initially immediate
);

create index if not exists idx_dest_status on public.tenant_destinations(status);
create index if not exists idx_dest_org    on public.tenant_destinations(org_id);

-- Provisioning runs: track per-enable attempt
create table if not exists public.provisioning_runs (
  correlation_id   text primary key default (extensions.gen_random_uuid())::text,
  org_id           text not null references public.tenants(org_id) on delete cascade,
  status           text not null check (status in ('pending','running','ready','failed')),
  md_db_name       text,
  md_sa_username   text,
  fivetran_destination_id text,
  metadata         jsonb not null default '{}'::jsonb,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Optional: enum for run status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status_t') THEN
    CREATE TYPE run_status_t AS ENUM ('pending','running','ready','failed');
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'provisioning_runs' AND column_name = 'status'
  ) THEN
    -- Drop legacy text CHECK constraint if present (default name)
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.provisioning_runs'::regclass
        AND contype = 'c'
        AND conname = 'provisioning_runs_status_check'
    ) THEN
      EXECUTE 'alter table public.provisioning_runs drop constraint provisioning_runs_status_check';
    END IF;

    -- Drop any default before type change
    EXECUTE 'alter table public.provisioning_runs alter column status drop default';

    ALTER TABLE public.provisioning_runs
      ALTER COLUMN status TYPE run_status_t USING status::run_status_t;
  END IF;
END$$;

create index if not exists idx_runs_org_created on public.provisioning_runs(org_id, created_at desc);
create index if not exists idx_runs_status       on public.provisioning_runs(status);
create index if not exists idx_runs_org_active   on public.provisioning_runs(org_id, started_at desc) where status in ('pending','running');

-- Keep provisioning_runs.updated_at fresh
drop trigger if exists trg_runs_set_updated_at on public.provisioning_runs;
create trigger trg_runs_set_updated_at
before update on public.provisioning_runs
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tenant_destinations'::regclass and conname='tenant_dest_md_db_name_chk'
  ) then
    alter table public.tenant_destinations
      add constraint tenant_dest_md_db_name_chk
      check (md_db_name ~ '^md_[a-z0-9_-]+$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tenant_destinations'::regclass and conname='tenant_dest_md_token_ref_nonempty'
  ) then
    alter table public.tenant_destinations
      add constraint tenant_dest_md_token_ref_nonempty
      check (length(md_token_ref) > 0);
  end if;
end$$;

create table if not exists public.connections (
  id                      uuid primary key default extensions.gen_random_uuid(),
  org_id                  text not null references public.tenants(org_id) on delete cascade,
  source_type             text not null,
  fivetran_connector_id   text unique,
  schema_name             text,
  status                  conn_status_t not null default 'not_configured',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint uq_conn_per_source unique (org_id, source_type) deferrable initially immediate
);

-- Optional: avoid empty schema_name strings
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.connections'::regclass and conname='connections_schema_name_nonempty'
  ) then
    alter table public.connections
      add constraint connections_schema_name_nonempty
      check (schema_name is null or length(schema_name) > 0);
  end if;
end$$;

create index if not exists idx_connections_org_status  on public.connections(org_id, status);
create index if not exists idx_connections_org_created on public.connections(org_id, created_at);
create index if not exists idx_connections_healthy     on public.connections(org_id, updated_at desc) where status = 'healthy';

create table if not exists public.events (
  id             uuid primary key default extensions.gen_random_uuid(),
  org_id         text not null,
  provider       text not null,
  type           text not null,
  correlation_id text,
  payload        jsonb not null,
  created_at     timestamptz not null default now(),
  created_on     date
);

-- Monotonic per-run sequence for resumability
alter table public.events add column if not exists event_seq bigserial;
create unique index if not exists uq_events_run_seq on public.events(correlation_id, event_seq);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.events'::regclass and conname='events_payload_object_chk'
  ) then
    alter table public.events
      add constraint events_payload_object_chk check (jsonb_typeof(payload) = 'object');
  end if;
end$$;

create index if not exists idx_events_org_time       on public.events(org_id, created_at desc);
create index if not exists idx_events_type_time      on public.events(type, created_at desc);
create index if not exists idx_events_corr           on public.events(correlation_id);
create index if not exists idx_events_org_created_on on public.events(org_id, created_on);
create index if not exists idx_events_org_type_time  on public.events(org_id, type, created_at desc);

drop trigger if exists trg_events_block_write on public.events;
create trigger trg_events_block_write
before update or delete on public.events
for each statement execute function public.block_update_delete();

drop trigger if exists trg_events_set_created_on on public.events;
create trigger trg_events_set_created_on
before insert or update of created_at on public.events
for each row execute function public.set_events_created_on();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.events'::regclass and conname='events_org_fk'
  ) then
    alter table public.events
      add constraint events_org_fk
      foreign key (org_id) references public.tenants(org_id)
      on delete cascade not valid;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='events' and indexname='events_vendor_dedupe_idx'
  ) then
    create unique index events_vendor_dedupe_idx
      on public.events (org_id, provider, (payload->>'id'))
      where payload ? 'id';
  else
    -- only recreate if legacy definition missing org_id
    if exists (
      select 1
      from pg_indexes
      where schemaname='public' and tablename='events' and indexname='events_vendor_dedupe_idx'
        and indexdef not like '% (org_id, provider, ((payload ->> ''id''))) %'
    ) then
      execute 'drop index if exists events_vendor_dedupe_idx';
      execute 'create unique index events_vendor_dedupe_idx on public.events (org_id, provider, (payload->>''id'')) where payload ? ''id''';
    end if;
  end if;
end$$;

create table if not exists public.idempotency_keys (
  key           text primary key,
  org_id        text not null,
  first_seen_at timestamptz not null default now(),
  last_result   jsonb
);

create index if not exists idx_idem_org        on public.idempotency_keys(org_id);
create index if not exists idx_idem_first_seen on public.idempotency_keys(first_seen_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.idempotency_keys'::regclass and conname='idempotency_keys_nonempty_chk'
  ) then
    alter table public.idempotency_keys
      add constraint idempotency_keys_nonempty_chk check (length(key) > 0);
  end if;
end$$;

create table if not exists public.tenant_quotas (
  org_id               text primary key references public.tenants(org_id) on delete cascade,
  max_connectors       integer,
  max_storage_gb_est   numeric,
  max_daily_rows       bigint,
  max_query_runtime_ms integer,
  updated_at           timestamptz not null default now()
);

-- Ensure quotas are positive
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tenant_quotas'::regclass and conname='quotas_positive_chk'
  ) then
    alter table public.tenant_quotas
      add constraint quotas_positive_chk check (
        (max_connectors is null or max_connectors > 0) and
        (max_storage_gb_est is null or max_storage_gb_est > 0) and
        (max_daily_rows is null or max_daily_rows > 0)
      );
  end if;
end$$;

-- =============================================================================
-- Connect triggers (attach helpers to enforce invariants)
-- =============================================================================

-- Tenants
drop trigger if exists trg_tenants_lowercase_slug on public.tenants;
create trigger trg_tenants_lowercase_slug
before insert or update of slug on public.tenants
for each row execute function public.lowercase_slug();

drop trigger if exists trg_tenants_block_slug on public.tenants;
create trigger trg_tenants_block_slug
before update of slug on public.tenants
for each row execute function public.block_slug_update();

drop trigger if exists trg_tenants_set_updated_at on public.tenants;
create trigger trg_tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists trg_tenants_block_org on public.tenants;
create trigger trg_tenants_block_org
before update of org_id on public.tenants
for each row execute function public.block_org_id_change();

-- Tenant destinations
drop trigger if exists trg_dest_set_updated_at on public.tenant_destinations;
create trigger trg_dest_set_updated_at
before update on public.tenant_destinations
for each row execute function public.set_updated_at();

drop trigger if exists trg_dest_block_org on public.tenant_destinations;
create trigger trg_dest_block_org
before update of org_id on public.tenant_destinations
for each row execute function public.block_org_id_change();

-- Connections
drop trigger if exists trg_conn_set_updated_at on public.connections;
create trigger trg_conn_set_updated_at
before update on public.connections
for each row execute function public.set_updated_at();

drop trigger if exists trg_conn_block_org on public.connections;
create trigger trg_conn_block_org
before update of org_id on public.connections
for each row execute function public.block_org_id_change();

-- Quotas
drop trigger if exists trg_quotas_set_updated_at on public.tenant_quotas;
create trigger trg_quotas_set_updated_at
before update on public.tenant_quotas
for each row execute function public.set_updated_at();

-- =============================================================================
-- [connect/04_rls.sql]
-- =============================================================================
alter table public.tenants             enable row level security;
alter table public.tenant_destinations enable row level security;
alter table public.connections         enable row level security;
alter table public.events              enable row level security;
alter table public.idempotency_keys    enable row level security;
alter table public.tenant_quotas       enable row level security;
-- source_types RLS is enabled after the table is created in [connect/06_reference.sql]
alter table public.provisioning_runs  enable row level security;

-- Read policies
drop policy if exists tenants_select_org on public.tenants;
create policy tenants_select_org
  on public.tenants for select
  using (org_id = (select public.current_org_id()));

drop policy if exists dest_select_org on public.tenant_destinations;
create policy dest_select_org
  on public.tenant_destinations for select
  using (org_id = (select public.current_org_id()));

drop policy if exists conns_select_org on public.connections;
create policy conns_select_org
  on public.connections for select
  using (org_id = (select public.current_org_id()));

drop policy if exists events_select_org on public.events;
create policy events_select_org
  on public.events for select
  using (org_id = (select public.current_org_id()));

drop policy if exists runs_select_org on public.provisioning_runs;
create policy runs_select_org
  on public.provisioning_runs for select
  using (org_id = (select public.current_org_id()));

drop policy if exists quotas_select_org on public.tenant_quotas;
create policy quotas_select_org
  on public.tenant_quotas for select
  using (org_id = (select public.current_org_id()));

 -- Service key bypasses RLS; no explicit service-role policies required.

-- =============================================================================
-- [connect/05_views.sql]
-- =============================================================================
drop view if exists public.v_tenants;
create view public.v_tenants
  with (security_invoker = true, security_barrier = true) as
select org_id, slug, status, created_at, updated_at
from public.tenants;

drop view if exists public.v_tenant_destinations;
create view public.v_tenant_destinations
  with (security_invoker = true, security_barrier = true) as
select id, org_id, md_db_name, status, last_event_at, created_at, updated_at
from public.tenant_destinations;

-- Harden: base-table access via view only
revoke all on table public.tenant_destinations from anon, authenticated;
grant select on table public.v_tenant_destinations to authenticated;
-- Apply same pattern to tenants base table
revoke all on table public.tenants from anon, authenticated;
grant select on table public.v_tenants to authenticated;

drop view if exists public.v_connections;
create view public.v_connections
  with (security_invoker = true, security_barrier = true) as
select id, org_id, source_type, schema_name, status, created_at, updated_at
from public.connections;

-- Harden: base-table access via view only
revoke all on table public.connections from anon, authenticated;
grant select on table public.v_connections to authenticated;
comment on table  public.tenants             is 'Tenant registry keyed by org_id; 1:1 with auth org.';
comment on table  public.tenant_destinations is 'Per-tenant MotherDuck DB + Fivetran destination metadata.';
comment on table  public.connections         is 'Per-tenant Fivetran connectors (one per source_type).';
comment on table  public.events              is 'Append-only event log (webhooks + system). created_on is UTC date via trigger.';
comment on table  public.idempotency_keys    is 'Idempotency cache for long-running sagas.';
-- Moved below after table creation:
-- comment on table  public.source_types        is 'Allowed connector types; referenced by connections.source_type.';
comment on table  public.provisioning_runs   is 'Tracks per-enable provisioning attempts per org (correlation_id/status/metadata).';

-- Column comments (public)
comment on column public.tenants.org_id                is 'Clerk organization id (e.g., org_...)';
comment on column public.tenants.slug                  is 'URL-safe tenant slug; unique per org';
comment on column public.tenants.status                is 'Tenant lifecycle status';
comment on column public.tenants.created_at            is 'Row creation time';
comment on column public.tenants.updated_at            is 'Row update time';

comment on column public.tenant_destinations.org_id              is 'Owning organization id';
comment on column public.tenant_destinations.md_db_name          is 'MotherDuck database name for this tenant';
comment on column public.tenant_destinations.md_token_ref        is 'Vault secret reference key (not plaintext)';
comment on column public.tenant_destinations.fivetran_destination_id is 'Fivetran destination id';
comment on column public.tenant_destinations.status              is 'Destination health status';
comment on column public.tenant_destinations.last_event_at       is 'Last event timestamp for this destination';
comment on column public.tenant_destinations.created_at          is 'Row creation time';
comment on column public.tenant_destinations.updated_at          is 'Row update time';

comment on column public.connections.org_id             is 'Owning organization id';
comment on column public.connections.source_type        is 'Connector source type code (FK to source_types.code)';
comment on column public.connections.fivetran_connector_id is 'Fivetran connector id';
comment on column public.connections.schema_name        is 'Schema name used for connector ingestion';
comment on column public.connections.status             is 'Connector status';
comment on column public.connections.created_at         is 'Row creation time';
comment on column public.connections.updated_at         is 'Row update time';

comment on column public.events.org_id                  is 'Owning organization id';
comment on column public.events.provider                is 'Event provider/source (system, fivetran, motherduck, ui)';
comment on column public.events.type                    is 'Event type (e.g., provision.started)';
comment on column public.events.correlation_id          is 'Correlation id per saga/run';
comment on column public.events.payload                 is 'Event payload (JSON object)';
comment on column public.events.created_at              is 'Event creation time';
comment on column public.events.created_on              is 'UTC date derived from created_at';
comment on column public.events.event_seq               is 'Monotonic sequence per correlation_id';

comment on column public.idempotency_keys.key           is 'Idempotency key string';
comment on column public.idempotency_keys.org_id        is 'Owning organization id';
comment on column public.idempotency_keys.first_seen_at is 'First time this key was seen';
comment on column public.idempotency_keys.last_result   is 'Cached result payload (JSON)';

comment on column public.provisioning_runs.correlation_id is 'Run correlation id (primary key)';
comment on column public.provisioning_runs.org_id         is 'Owning organization id';
comment on column public.provisioning_runs.status         is 'Run status (enum run_status_t)';
comment on column public.provisioning_runs.md_db_name     is 'Target MotherDuck database name';
comment on column public.provisioning_runs.md_sa_username is 'MotherDuck service account username';
comment on column public.provisioning_runs.fivetran_destination_id is 'Fivetran destination id for tenant';
comment on column public.provisioning_runs.metadata       is 'Additional run metadata (JSON)';
comment on column public.provisioning_runs.started_at     is 'Run start time';
comment on column public.provisioning_runs.finished_at    is 'Run finish time (if set)';
comment on column public.provisioning_runs.created_at     is 'Row creation time';
comment on column public.provisioning_runs.updated_at     is 'Row update time';

comment on column public.source_types.code               is 'Connector source type code';
comment on column public.source_types.label              is 'Human-readable label for connector type';

comment on column public.conversations.id                is 'Conversation id';
comment on column public.conversations.org_id            is 'Owning organization id';
comment on column public.conversations.owner_user_id     is 'Owner user id (Clerk sub)';
comment on column public.conversations.title             is 'Conversation title';
comment on column public.conversations.model             is 'Model used for this conversation';
comment on column public.conversations.system_prompt     is 'System prompt text';
comment on column public.conversations.archived_at       is 'Archive timestamp (null if active)';
comment on column public.conversations.created_at        is 'Row creation time';
comment on column public.conversations.updated_at        is 'Row update time';

comment on column public.messages.id                     is 'Message id';
comment on column public.messages.conversation_id        is 'FK to conversation';
comment on column public.messages.org_id                 is 'Owning organization id (denormalized)';
comment on column public.messages.owner_user_id          is 'Owner user id (denormalized)';
comment on column public.messages.role                   is 'Message role (user, assistant, system, tool, function)';
comment on column public.messages.content                is 'Message content (JSON)';
comment on column public.messages.text_content           is 'Plain text extraction for search/snippets';
comment on column public.messages.model                  is 'Model returned/used for message';
comment on column public.messages.tool_name              is 'Tool name used (if any)';
comment on column public.messages.tool_call_id           is 'Tool call id (if any)';
comment on column public.messages.error                  is 'Error text if generation failed';
comment on column public.messages.idempotency_key        is 'Idempotency key for retries';
comment on column public.messages.created_at             is 'Row creation time';
comment on column public.messages.updated_at             is 'Row update time';

comment on table  public.rate_limits                     is 'Per-user action counters for rate limiting (server-only)';
comment on column public.rate_limits.user_id             is 'User id for rate limiting bucket';
comment on column public.rate_limits.action              is 'Action name for rate limiting';
comment on column public.rate_limits.window_start        is 'Bucket window start time (minute granularity)';
comment on column public.rate_limits.count               is 'Requests in current bucket';

-- =============================================================================
-- [connect/06_reference.sql]
-- =============================================================================
create table if not exists public.source_types (
  code  text primary key,
  label text not null
);

-- Now comment the table
comment on table  public.source_types        is 'Allowed connector types; referenced by connections.source_type.';

insert into public.source_types (code, label) values
  ('facebook_ads','Meta Ads'),
  ('google_ads','Google Ads'),
  ('tiktok_ads','TikTok Ads'),
  ('linkedin_ads','LinkedIn Ads')
on conflict (code) do nothing;

create index if not exists idx_source_types_label on public.source_types using gin (label extensions.gin_trgm_ops);

do $$
begin
  if to_regclass('public.connections') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid='public.connections'::regclass
         and conname='connections_source_type_fk'
     ) then
    alter table public.connections
      add constraint connections_source_type_fk
      foreign key (source_type) references public.source_types(code) not valid;
  end if;
end$$;

-- Enable RLS and policies for source_types now that it exists
alter table public.source_types enable row level security;
drop policy if exists source_types_read_all on public.source_types;
create policy source_types_read_all
  on public.source_types for select
  using (true);

-- Validate connections.source_type FK if present
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='public.connections'::regclass and conname='connections_source_type_fk' and not convalidated
  ) then
    alter table public.connections validate constraint connections_source_type_fk;
  end if;
end$$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='public.events'::regclass and conname='events_org_fk' and not convalidated
  ) then
    alter table public.events validate constraint events_org_fk;
  end if;
end$$;

-- Enforce non-empty provider/type
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.events'::regclass and conname='events_provider_nonempty'
  ) then
    alter table public.events
      add constraint events_provider_nonempty check (length(provider) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.events'::regclass and conname='events_type_nonempty'
  ) then
    alter table public.events
      add constraint events_type_nonempty check (length(type) > 0);
  end if;
end$$;

-- =============================================================================
-- [clerk/00_schema.sql]
-- =============================================================================
create schema if not exists clerk;
-- pgcrypto is standardized in the extensions schema above

-- =============================================================================
-- [clerk/01_functions.sql]
-- =============================================================================
create or replace function clerk.set_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at := now();
  return new;
end$$;

alter function clerk.set_synced_at() set search_path = pg_catalog, clerk;

-- =============================================================================
-- [clerk/02_events.sql]
-- =============================================================================
create table if not exists clerk.events (
  svix_message_id   text primary key,
  event_type        text not null,
  object_type       text not null,
  object_id         text,
  organization_id   text,
  user_id           text,
  payload           jsonb not null,
  occurred_at       timestamptz,
  received_at       timestamptz not null default now(),
  constraint ck_events_event_type_nonempty  check (length(event_type)  > 0),
  constraint ck_events_object_type_nonempty check (length(object_type) > 0)
);

create index if not exists idx_clerk_events_type_time   on clerk.events (event_type, received_at desc);
create index if not exists idx_clerk_events_obj         on clerk.events (object_type, object_id);
create index if not exists idx_clerk_events_org         on clerk.events (organization_id);
create index if not exists idx_clerk_events_user        on clerk.events (user_id);
create index if not exists idx_clerk_events_payload_gin on clerk.events using gin (payload);

-- =============================================================================
-- [clerk/03_raw_objects.sql]
-- =============================================================================
create table if not exists clerk.raw_objects (
  object_type   text not null,
  object_id     text not null,
  data          jsonb not null,
  updated_at    timestamptz,
  synced_at     timestamptz not null default now(),
  deleted_at    timestamptz,
  data_hash     text generated always as (encode(extensions.digest(data::text, 'sha256'), 'hex')) stored,
  primary key (object_type, object_id)
);
create index if not exists idx_clerk_raw_objects_gin on clerk.raw_objects using gin (data);

-- Backfill column for older installs where data_hash was missing
alter table clerk.raw_objects
  add column if not exists data_hash text
  generated always as (encode(extensions.digest(data::text, 'sha256'), 'hex')) stored;

-- =============================================================================
-- [clerk/04_typed.sql]
-- =============================================================================
create table if not exists clerk.users (
  user_id                      text primary key,
  username                     text,
  first_name                   text,
  last_name                    text,
  image_url                    text,
  primary_email_address_id     text,
  primary_phone_number_id      text,
  primary_web3_wallet_id       text,
  public_metadata              jsonb not null default '{}'::jsonb,
  private_metadata             jsonb not null default '{}'::jsonb,
  unsafe_metadata              jsonb not null default '{}'::jsonb,
  created_at                   timestamptz,
  updated_at                   timestamptz,
  synced_at                    timestamptz not null default now()
);

create table if not exists clerk.email_addresses (
  email_address_id     text primary key,
  user_id              text not null references clerk.users(user_id) on delete cascade deferrable initially deferred,
  email_address        text not null,
  is_primary_for_user  boolean not null default false,
  verification_status  text,
  verification         jsonb not null default '{}'::jsonb,
  linked_to            jsonb not null default '[]'::jsonb,
  created_at           timestamptz,
  updated_at           timestamptz,
  synced_at            timestamptz not null default now(),
  constraint uq_clerk_email_per_user unique (user_id, email_address)
);
create index if not exists idx_clerk_email_user     on clerk.email_addresses (user_id);
create index if not exists idx_clerk_email_verified on clerk.email_addresses (verification_status);
create index if not exists idx_clerk_email_verif_js on clerk.email_addresses using gin (verification);

create table if not exists clerk.phone_numbers (
  phone_number_id      text primary key,
  user_id              text not null references clerk.users(user_id) on delete cascade deferrable initially deferred,
  phone_number         text not null,
  is_primary_for_user  boolean not null default false,
  verification_status  text,
  verification         jsonb not null default '{}'::jsonb,
  reserved_for_second_factor boolean,
  created_at           timestamptz,
  updated_at           timestamptz,
  synced_at            timestamptz not null default now(),
  constraint uq_clerk_phone_per_user unique (user_id, phone_number)
);
create index if not exists idx_clerk_phone_user     on clerk.phone_numbers (user_id);
create index if not exists idx_clerk_phone_verif_js on clerk.phone_numbers using gin (verification);

create table if not exists clerk.web3_wallets (
  web3_wallet_id       text primary key,
  user_id              text not null references clerk.users(user_id) on delete cascade deferrable initially deferred,
  address              text not null,
  verification_status  text,
  verification         jsonb not null default '{}'::jsonb,
  created_at           timestamptz,
  updated_at           timestamptz,
  synced_at            timestamptz not null default now(),
  constraint uq_clerk_wallet_per_user unique (user_id, address)
);
create index if not exists idx_clerk_wallet_user     on clerk.web3_wallets (user_id);
create index if not exists idx_clerk_wallet_verif_js on clerk.web3_wallets using gin (verification);

create table if not exists clerk.external_accounts (
  external_account_id  text primary key,
  user_id              text not null references clerk.users(user_id) on delete cascade deferrable initially deferred,
  provider             text,
  provider_user_id     text,
  approved_scopes      text,
  email_address        text,
  username             text,
  first_name           text,
  last_name            text,
  picture_url          text,
  created_at           timestamptz,
  updated_at           timestamptz,
  synced_at            timestamptz not null default now()
);
create index if not exists idx_clerk_extacct_user     on clerk.external_accounts (user_id);
create index if not exists idx_clerk_extacct_provider on clerk.external_accounts (provider);

create table if not exists clerk.sessions (
  session_id        text primary key,
  user_id           text not null references clerk.users(user_id) on delete cascade deferrable initially deferred,
  status            text,
  client_id         text,
  last_active_at    timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz,
  updated_at        timestamptz,
  synced_at         timestamptz not null default now()
);
create index if not exists idx_clerk_sessions_user   on clerk.sessions (user_id);
create index if not exists idx_clerk_sessions_status on clerk.sessions (status);

alter table clerk.users
  drop constraint if exists fk_users_primary_email,
  drop constraint if exists fk_users_primary_phone,
  drop constraint if exists fk_users_primary_web3;

alter table clerk.users
  add constraint fk_users_primary_email
    foreign key (primary_email_address_id) references clerk.email_addresses(email_address_id)
    deferrable initially deferred,
  add constraint fk_users_primary_phone
    foreign key (primary_phone_number_id) references clerk.phone_numbers(phone_number_id)
    deferrable initially deferred,
  add constraint fk_users_primary_web3
    foreign key (primary_web3_wallet_id) references clerk.web3_wallets(web3_wallet_id)
    deferrable initially deferred;

create table if not exists clerk.organizations (
  organization_id           text primary key,
  name                      text,
  slug                      text unique,
  image_url                 text,
  max_allowed_memberships   integer,
  members_count             integer,
  public_metadata           jsonb not null default '{}'::jsonb,
  private_metadata          jsonb not null default '{}'::jsonb,
  created_at                timestamptz,
  updated_at                timestamptz,
  synced_at                 timestamptz not null default now()
);

create table if not exists clerk.organization_memberships (
  membership_id        text primary key,
  organization_id      text not null references clerk.organizations(organization_id) on delete cascade deferrable initially deferred,
  user_id              text not null references clerk.users(user_id) on delete cascade deferrable initially deferred,
  role                 text,
  public_metadata      jsonb not null default '{}'::jsonb,
  private_metadata     jsonb not null default '{}'::jsonb,
  created_at           timestamptz,
  updated_at           timestamptz,
  synced_at            timestamptz not null default now(),
  constraint uq_clerk_membership_unique unique (organization_id, user_id)
);
create index if not exists idx_clerk_memberships_org  on clerk.organization_memberships (organization_id);
create index if not exists idx_clerk_memberships_user on clerk.organization_memberships (user_id);
create index if not exists idx_clerk_memberships_role on clerk.organization_memberships (role);

create table if not exists clerk.organization_invitations (
  invitation_id       text primary key,
  organization_id     text not null references clerk.organizations(organization_id) on delete cascade deferrable initially deferred,
  email_address       text not null,
  role                text,
  inviter_user_id     text,
  status              text,
  public_metadata     jsonb not null default '{}'::jsonb,
  created_at          timestamptz,
  updated_at          timestamptz,
  synced_at           timestamptz not null default now()
);
create index if not exists idx_clerk_invites_org    on clerk.organization_invitations (organization_id);
create index if not exists idx_clerk_invites_email  on clerk.organization_invitations (email_address);
create index if not exists idx_clerk_invites_status on clerk.organization_invitations (status);

create table if not exists clerk.clients (
  client_id        text primary key,
  user_id          text references clerk.users(user_id) on delete cascade deferrable initially deferred,
  last_active_at   timestamptz,
  created_at       timestamptz,
  updated_at       timestamptz,
  sessions         jsonb not null default '[]'::jsonb,
  metadata         jsonb not null default '{}'::jsonb,
  synced_at        timestamptz not null default now()
);
create index if not exists idx_clerk_clients_user on clerk.clients (user_id);

create table if not exists clerk.organization_domains (
  organization_domain_id  text primary key,
  organization_id         text not null references clerk.organizations(organization_id) on delete cascade deferrable initially deferred,
  name                    text not null,
  verification            jsonb not null default '{}'::jsonb,
  created_at              timestamptz,
  updated_at              timestamptz,
  synced_at               timestamptz not null default now(),
  constraint uq_clerk_org_domain unique (organization_id, name)
);
create index if not exists idx_clerk_org_domains_org on clerk.organization_domains (organization_id);

-- =============================================================================
-- [clerk/05_triggers.sql]
-- =============================================================================
do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'clerk'
      and tablename in (
        'users','email_addresses','phone_numbers','web3_wallets','external_accounts',
        'sessions','organizations','organization_memberships','organization_invitations',
        'clients','organization_domains','raw_objects'
      )
  loop
    execute format('drop trigger if exists trg_%I_set_synced_at on clerk.%I;', r.tablename, r.tablename);
    execute format('create trigger trg_%I_set_synced_at before update on clerk.%I
                    for each row execute function clerk.set_synced_at();', r.tablename, r.tablename);
  end loop;
end$$;

-- Lock down clerk schema for app roles
revoke usage on schema clerk from anon, authenticated;
revoke all on all tables in schema clerk from anon, authenticated;
alter default privileges in schema clerk revoke all on tables from anon, authenticated;

-- =============================================================================
-- [chat/00_extensions.sql]
-- =============================================================================
-- pgcrypto is standardized in the extensions schema above

-- =============================================================================
-- [chat/01_functions.sql]
-- =============================================================================
-- jwt_claim is defined once (canonical) in the connect functions section above

create or replace function public.set_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.messages_apply_parent_context()
returns trigger
language plpgsql
as $$
declare
  v_org   text;
  v_owner text;
begin
  select c.org_id, c.owner_user_id
    into v_org, v_owner
  from public.conversations c
  where c.id = new.conversation_id;

  if v_org is null then
    raise exception 'Conversation % not found', new.conversation_id;
  end if;

  new.org_id := v_org;
  new.owner_user_id := v_owner;
  return new;
end;
$$;

create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
     set updated_at = now()
   where id = new.conversation_id;
  return null;
end;
$$;

-- Optional rate limit infra
create table if not exists public.rate_limits (
  user_id text,
  action text,
  window_start timestamptz,
  count int,
  primary key (user_id, action, window_start)
);

alter table public.rate_limits enable row level security;

drop policy if exists rl_select_none on public.rate_limits;
create policy rl_select_none on public.rate_limits for select using (false);

-- Removed service-claim write policy; service key bypasses RLS; writes via SECURITY DEFINER helpers only
-- drop policy if exists rl_write_service on public.rate_limits;

create or replace function public.rate_limit_check(p_user_id text, p_action text, p_window interval, p_limit int)
returns void
language plpgsql as $$
declare
  v_start timestamptz := date_trunc('minute', now());
  v_window_start timestamptz := v_start - p_window + interval '1 minute';
  v_cnt int;
begin
  -- roll current window
  insert into public.rate_limits(user_id, action, window_start, count)
  values (p_user_id, p_action, v_start, 0)
  on conflict (user_id, action, window_start) do nothing;

  -- aggregate counts over window
  select coalesce(sum(count), 0)
    into v_cnt
  from public.rate_limits
  where user_id = p_user_id
    and action  = p_action
    and window_start >= v_window_start;

  if v_cnt >= p_limit then
    raise exception 'Rate limit exceeded for %', p_action using errcode = 'P0001';
  end if;

  -- increment current minute bucket
  update public.rate_limits
     set count = count + 1
   where user_id = p_user_id
     and action  = p_action
     and window_start = v_start;
end;
$$;

-- Harden and elevate for server-side execution
alter function public.rate_limit_check(text, text, interval, int)
  owner to postgres;
alter function public.rate_limit_check(text, text, interval, int)
  security definer;
alter function public.rate_limit_check(text, text, interval, int)
  set search_path = pg_catalog, public;

-- Moved below (after tables): rpc_append_message depends on public.messages type

-- Harden: lock search_path on chat functions
alter function public.jwt_claim(text)
  set search_path = pg_catalog, public;
alter function public.set_conversations_updated_at()
  set search_path = pg_catalog, public;
alter function public.set_messages_updated_at()
  set search_path = pg_catalog, public;
alter function public.messages_apply_parent_context()
  set search_path = pg_catalog, public;
alter function public.touch_conversation_updated_at()
  set search_path = pg_catalog, public;

-- =============================================================================
-- [chat/02_tables.sql]
-- =============================================================================
create table if not exists public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  org_id text not null,
  owner_user_id text not null,
  title text,
  model text,
  system_prompt text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  org_id text not null,
  owner_user_id text not null,
  role text not null check (role in ('user','assistant','system','tool','function')),
  content jsonb not null,
  text_content text generated always as (
    case
      when jsonb_typeof(content) = 'string' then trim(both '"' from content::text)
      when content ? 'text' then content->>'text'
      else null
    end
  ) stored,
  model text,
  tool_name text,
  tool_call_id text,
  error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Remove foreign key constraint to tenants table since we use Clerk mirror
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='public.messages'::regclass and conname='messages_org_fk'
  ) then
    alter table public.messages drop constraint messages_org_fk;
  end if;
end$$;

-- Helper function to get organization data from Clerk mirror
create or replace function public.get_org_from_clerk_mirror(p_org_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_org_data jsonb;
begin
  -- First try to get organization data from Clerk raw_objects table (where the full data is stored)
  select data into v_org_data
  from clerk.raw_objects
  where object_type = 'organization'
    and object_id = p_org_id
    and deleted_at is null;

  -- If not found in raw_objects, check if organization exists in organizations table
  if v_org_data is null then
    if exists (
      select 1
      from clerk.organizations
      where organization_id = p_org_id
    ) then
      -- Organization exists in organizations table, return a minimal object
      return jsonb_build_object('id', p_org_id, 'exists', true);
    end if;
  end if;

  return v_org_data;
end;
$$;

-- Set proper permissions for the helper function
alter function public.get_org_from_clerk_mirror(text) set search_path = pg_catalog, public;
grant execute on function public.get_org_from_clerk_mirror(text) to authenticated;

-- Post-tables: RPC append message (returns public.messages)
create or replace function public.rpc_append_message(
  p_conversation_id uuid,
  p_role text,
  p_content jsonb,
  p_idempotency_key text default null
)
returns public.messages
language plpgsql
security invoker
as $$
declare
  v_msg public.messages;
  v_sub text;
  v_org text;
begin
  v_sub := auth.jwt()->>'sub';
  v_org := public.current_org_id();

  -- Verify organization exists in Clerk mirror
  if public.get_org_from_clerk_mirror(v_org) is null then
    raise exception 'Organization % not found in Clerk mirror', v_org using errcode = '42501';
  end if;

  -- optional rate limiting: 120 messages per 5 minutes per user
  perform public.rate_limit_check(v_sub, 'append_message', interval '5 minutes', 120);

  if p_role not in ('user','assistant','system','tool','function') then
    raise exception 'Invalid role: %', p_role using errcode = '22023';
  end if;

  if pg_column_size(p_content) > 64 * 1024 then
    raise exception 'Content too large' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and c.owner_user_id = v_sub
      and c.org_id = v_org
  ) then
    raise exception 'Conversation not found or not owned by caller' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    insert into public.messages (conversation_id, org_id, owner_user_id, role, content)
    values (p_conversation_id, v_org, v_sub, p_role, p_content)
    returning * into v_msg;
  else
    insert into public.messages (conversation_id, org_id, owner_user_id, role, content, idempotency_key)
    values (p_conversation_id, v_org, v_sub, p_role, p_content, p_idempotency_key)
    on conflict (conversation_id, idempotency_key)
    where idempotency_key is not null
    do update set idempotency_key = excluded.idempotency_key
    returning * into v_msg;
  end if;

  return v_msg;
end;
$$;

alter function public.rpc_append_message(uuid, text, jsonb, text)
  set search_path = pg_catalog, public;

-- =============================================================================
-- [chat/03_indexes.sql]
-- =============================================================================
create index if not exists idx_conversations_org_updated
  on public.conversations (org_id, updated_at desc);

create index if not exists idx_conversations_org_owner_updated
  on public.conversations (org_id, owner_user_id, updated_at desc);

create index if not exists idx_conversations_org_updated_active
  on public.conversations (org_id, updated_at desc)
  where archived_at is null;

create unique index if not exists uq_messages_convo_idem
  on public.messages (conversation_id, idempotency_key)
  where idempotency_key is not null;

drop index if exists idx_messages_convo_created;
create index if not exists idx_messages_convo_created
  on public.messages (conversation_id, created_at asc, id asc);

create index if not exists idx_messages_org_owner_created
  on public.messages (org_id, owner_user_id, created_at asc);

create index if not exists idx_messages_convo_created_ok
  on public.messages (conversation_id, created_at asc)
  where error is null;

drop index if exists idx_messages_org_type_time;
create index if not exists idx_messages_org_role_time
  on public.messages(org_id, role, created_at desc);

-- =============================================================================
-- [chat/04_triggers.sql]
-- =============================================================================
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_conversations_updated_at();

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at
before update on public.messages
for each row execute function public.set_messages_updated_at();

drop trigger if exists messages_apply_parent_context_ins on public.messages;
create trigger messages_apply_parent_context_ins
before insert on public.messages
for each row execute function public.messages_apply_parent_context();

drop trigger if exists messages_apply_parent_context_upd on public.messages;
create trigger messages_apply_parent_context_upd
before update of conversation_id on public.messages
for each row execute function public.messages_apply_parent_context();

-- Optional: block moving messages between conversations
create or replace function public.block_message_move()
returns trigger language plpgsql as $$
begin
  if old.conversation_id is distinct from new.conversation_id then
    raise exception 'Updating conversation_id is not allowed';
  end if;
  return new;
end;
$$;

alter function public.block_message_move()
  set search_path = pg_catalog, public;

drop trigger if exists trg_messages_block_move on public.messages;
create trigger trg_messages_block_move
before update of conversation_id on public.messages
for each row execute function public.block_message_move();

drop trigger if exists messages_touch_parent_after_ins on public.messages;
create trigger messages_touch_parent_after_ins
after insert on public.messages
for each row execute function public.touch_conversation_updated_at();

-- =============================================================================
-- [chat/05_rls.sql]
-- =============================================================================
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own
on public.conversations
for select
using (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
);

drop policy if exists conversations_insert_self on public.conversations;
create policy conversations_insert_self
on public.conversations
for insert
with check (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
);

drop policy if exists conversations_update_own on public.conversations;
create policy conversations_update_own
on public.conversations
for update
using (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
)
with check (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
);

drop policy if exists conversations_delete_own on public.conversations;
create policy conversations_delete_own
on public.conversations
for delete
using (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
);

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own
on public.messages
for select
using (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
  and exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.owner_user_id = (select auth.jwt()->>'sub')
      and c.org_id = (select public.current_org_id())
  )
);

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own
on public.messages
for insert
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.owner_user_id = (select auth.jwt()->>'sub')
      and c.org_id = (select public.current_org_id())
  )
);

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own
on public.messages
for update
using (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
  and exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.owner_user_id = (select auth.jwt()->>'sub')
      and c.org_id = (select public.current_org_id())
  )
)
with check (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
);

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own
on public.messages
for delete
using (
  owner_user_id = (select auth.jwt()->>'sub')
  and org_id     = (select public.current_org_id())
  and exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.owner_user_id = (select auth.jwt()->>'sub')
      and c.org_id = (select public.current_org_id())
  )
);

-- =============================================================================
-- [chat view: conversation_summaries]
-- =============================================================================
drop view if exists public.conversation_summaries;
create view public.conversation_summaries
  with (security_invoker = true, security_barrier = true) as
select
  c.id,
  c.org_id,
  c.owner_user_id,
  c.title,
  c.model,
  c.archived_at,
  c.created_at,
  c.updated_at,
  (
    select m.text_content
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) as last_message_text
from public.conversations c;

create or replace function public.check_archive_has_messages()
returns trigger as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    if not exists (
      select 1 from public.messages
      where conversation_id = new.id
    ) then
      raise exception 'Cannot archive empty conversation';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- Attach archive guard
drop trigger if exists trg_conversations_archive_guard on public.conversations;
create trigger trg_conversations_archive_guard
before update of archived_at on public.conversations
for each row execute function public.check_archive_has_messages();

alter function public.check_archive_has_messages()
  set search_path = pg_catalog, public;

-- Vault helpers (SECURITY DEFINER): server-only secret access
do $$
begin
  if public._vault_available() then
    execute $fn$
      create or replace function public.vault_get_secret(p_name text)
      returns text
      as $f$
        select s.decrypted_secret
        from vault.decrypted_secrets s
        where s.name = p_name
        limit 1
      $f$ language sql security definer set search_path = pg_catalog, public;
    $fn$;

    execute $fn2$
      create or replace function public.vault_md_sa_token(p_org_id text)
      returns text
      as $f$
        select public.vault_get_secret('md_sa_token:' || p_org_id)
      $f$ language sql security definer set search_path = pg_catalog, public;
    $fn2$;
  else
    execute $stub$
      create or replace function public.vault_get_secret(p_name text)
      returns text
      as $f$
      begin
        raise exception 'Supabase Vault is not enabled in this environment. Enable it in Dashboard → Database → Extensions.' using errcode = 'P0001';
      end;
      $f$ language plpgsql security definer set search_path = pg_catalog, public;
    $stub$;

    execute $stub2$
      create or replace function public.vault_md_sa_token(p_org_id text)
      returns text
      as $f$
      begin
        raise exception 'Supabase Vault is not enabled in this environment. Enable it in Dashboard → Database → Extensions.' using errcode = 'P0001';
      end;
      $f$ language plpgsql security definer set search_path = pg_catalog, public;
    $stub2$;
  end if;
end$$;

-- Vault function ownership and EXECUTE privileges (server-only)
alter function public.vault_get_secret(text) owner to postgres;
alter function public.vault_md_sa_token(text) owner to postgres;
revoke all on function public.vault_get_secret(text) from public, anon, authenticated;
revoke all on function public.vault_md_sa_token(text) from public, anon, authenticated;
grant execute on function public.vault_get_secret(text) to service_role;
grant execute on function public.vault_md_sa_token(text) to service_role;

-- Clerk mirror — comments
comment on table  clerk.events                    is 'Raw Clerk event ledger (svix_message_id primary key).';
comment on column clerk.events.svix_message_id     is 'Svix message id (unique)';
comment on column clerk.events.event_type          is 'Event type (e.g., user.created)';
comment on column clerk.events.object_type         is 'Object type (user, organization, etc.)';
comment on column clerk.events.object_id           is 'Object id (if applicable)';
comment on column clerk.events.organization_id     is 'Clerk organization id';
comment on column clerk.events.user_id             is 'Clerk user id';
comment on column clerk.events.payload             is 'Full Clerk event payload (JSON)';
comment on column clerk.events.occurred_at         is 'Event occurred_at (from Clerk)';
comment on column clerk.events.received_at         is 'Ingest time';

comment on table  clerk.raw_objects               is 'Latest full object snapshots with tombstones and hash.';
comment on column clerk.raw_objects.object_type    is 'Object type name';
comment on column clerk.raw_objects.object_id      is 'Object id';
comment on column clerk.raw_objects.data           is 'Latest object payload (JSON)';
comment on column clerk.raw_objects.updated_at     is 'Clerk updated_at (best available)';
comment on column clerk.raw_objects.synced_at      is 'Mirror sync time';
comment on column clerk.raw_objects.deleted_at     is 'Tombstone time (if deleted)';
comment on column clerk.raw_objects.data_hash      is 'SHA-256 hex of data field';

comment on table  clerk.users                     is 'Clerk users mirror';
comment on column clerk.users.user_id              is 'Clerk user id';
comment on column clerk.users.username             is 'Username';
comment on column clerk.users.first_name           is 'First name';
comment on column clerk.users.last_name            is 'Last name';
comment on column clerk.users.image_url            is 'Image URL';
comment on column clerk.users.primary_email_address_id is 'Primary email address id';
comment on column clerk.users.primary_phone_number_id  is 'Primary phone number id';
comment on column clerk.users.primary_web3_wallet_id   is 'Primary web3 wallet id';
comment on column clerk.users.public_metadata      is 'Public metadata (JSON)';
comment on column clerk.users.private_metadata     is 'Private metadata (JSON)';
comment on column clerk.users.unsafe_metadata      is 'Unsafe metadata (JSON)';
comment on column clerk.users.created_at           is 'Clerk created_at';
comment on column clerk.users.updated_at           is 'Clerk updated_at';
comment on column clerk.users.synced_at            is 'Mirror sync time';

comment on table  clerk.email_addresses           is 'Clerk email addresses mirror';
comment on column clerk.email_addresses.email_address_id is 'Email address id';
comment on column clerk.email_addresses.user_id    is 'User id';
comment on column clerk.email_addresses.email_address is 'Email';
comment on column clerk.email_addresses.is_primary_for_user is 'Whether primary for user';
comment on column clerk.email_addresses.verification_status is 'Verification status';
comment on column clerk.email_addresses.verification is 'Verification JSON';
comment on column clerk.email_addresses.linked_to  is 'Linked identities';
comment on column clerk.email_addresses.created_at is 'Clerk created_at';
comment on column clerk.email_addresses.updated_at is 'Clerk updated_at';
comment on column clerk.email_addresses.synced_at  is 'Mirror sync time';

comment on table  clerk.phone_numbers             is 'Clerk phone numbers mirror';
comment on column clerk.phone_numbers.phone_number_id is 'Phone number id';
comment on column clerk.phone_numbers.user_id      is 'User id';
comment on column clerk.phone_numbers.phone_number is 'Phone number';
comment on column clerk.phone_numbers.is_primary_for_user is 'Whether primary for user';
comment on column clerk.phone_numbers.verification_status is 'Verification status';
comment on column clerk.phone_numbers.verification is 'Verification JSON';
comment on column clerk.phone_numbers.reserved_for_second_factor is 'Reserved for 2FA';
comment on column clerk.phone_numbers.created_at   is 'Clerk created_at';
comment on column clerk.phone_numbers.updated_at   is 'Clerk updated_at';
comment on column clerk.phone_numbers.synced_at    is 'Mirror sync time';

comment on table  clerk.web3_wallets              is 'Clerk web3 wallets mirror';
comment on column clerk.web3_wallets.web3_wallet_id is 'Wallet id';
comment on column clerk.web3_wallets.user_id      is 'User id';
comment on column clerk.web3_wallets.address      is 'Wallet address';
comment on column clerk.web3_wallets.verification_status is 'Verification status';
comment on column clerk.web3_wallets.verification is 'Verification JSON';
comment on column clerk.web3_wallets.created_at   is 'Clerk created_at';
comment on column clerk.web3_wallets.updated_at   is 'Clerk updated_at';
comment on column clerk.web3_wallets.synced_at    is 'Mirror sync time';

comment on table  clerk.external_accounts         is 'Clerk external accounts mirror';
comment on column clerk.external_accounts.external_account_id is 'External account id';
comment on column clerk.external_accounts.user_id  is 'User id';
comment on column clerk.external_accounts.provider is 'Provider';
comment on column clerk.external_accounts.provider_user_id is 'Provider user id';
comment on column clerk.external_accounts.approved_scopes is 'Approved scopes';
comment on column clerk.external_accounts.email_address is 'Email address';
comment on column clerk.external_accounts.username is 'Username';
comment on column clerk.external_accounts.first_name is 'First name';
comment on column clerk.external_accounts.last_name is 'Last name';
comment on column clerk.external_accounts.picture_url is 'Picture URL';
comment on column clerk.external_accounts.created_at is 'Clerk created_at';
comment on column clerk.external_accounts.updated_at is 'Clerk updated_at';
comment on column clerk.external_accounts.synced_at  is 'Mirror sync time';

comment on table  clerk.sessions                  is 'Clerk sessions mirror';
comment on column clerk.sessions.session_id        is 'Session id';
comment on column clerk.sessions.user_id           is 'User id';
comment on column clerk.sessions.status            is 'Session status';
comment on column clerk.sessions.client_id         is 'Client id';
comment on column clerk.sessions.last_active_at    is 'Last active time';
comment on column clerk.sessions.expires_at        is 'Expiry time';
comment on column clerk.sessions.created_at        is 'Clerk created_at';
comment on column clerk.sessions.updated_at        is 'Clerk updated_at';
comment on column clerk.sessions.synced_at         is 'Mirror sync time';

comment on table  clerk.organizations             is 'Clerk organizations mirror';
comment on column clerk.organizations.organization_id is 'Organization id';
comment on column clerk.organizations.name         is 'Organization name';
comment on column clerk.organizations.slug         is 'Organization slug';
comment on column clerk.organizations.image_url    is 'Image URL';
comment on column clerk.organizations.max_allowed_memberships is 'Max allowed memberships';
comment on column clerk.organizations.members_count is 'Members count';
comment on column clerk.organizations.public_metadata is 'Public metadata (JSON)';
comment on column clerk.organizations.private_metadata is 'Private metadata (JSON)';
comment on column clerk.organizations.created_at   is 'Clerk created_at';
comment on column clerk.organizations.updated_at   is 'Clerk updated_at';
comment on column clerk.organizations.synced_at    is 'Mirror sync time';

comment on table  clerk.organization_memberships  is 'Clerk organization memberships mirror';
comment on column clerk.organization_memberships.membership_id is 'Membership id';
comment on column clerk.organization_memberships.organization_id is 'Organization id';
comment on column clerk.organization_memberships.user_id is 'User id';
comment on column clerk.organization_memberships.role   is 'Role name';
comment on column clerk.organization_memberships.public_metadata is 'Public metadata (JSON)';
comment on column clerk.organization_memberships.private_metadata is 'Private metadata (JSON)';
comment on column clerk.organization_memberships.created_at is 'Clerk created_at';
comment on column clerk.organization_memberships.updated_at is 'Clerk updated_at';
comment on column clerk.organization_memberships.synced_at  is 'Mirror sync time';

comment on table  clerk.organization_invitations  is 'Clerk organization invitations mirror';
comment on column clerk.organization_invitations.invitation_id is 'Invitation id';
comment on column clerk.organization_invitations.organization_id is 'Organization id';
comment on column clerk.organization_invitations.email_address is 'Email address';
comment on column clerk.organization_invitations.role is 'Role name';
comment on column clerk.organization_invitations.inviter_user_id is 'Inviter user id';
comment on column clerk.organization_invitations.status is 'Invite status';
comment on column clerk.organization_invitations.public_metadata is 'Public metadata (JSON)';
comment on column clerk.organization_invitations.created_at is 'Clerk created_at';
comment on column clerk.organization_invitations.updated_at is 'Clerk updated_at';
comment on column clerk.organization_invitations.synced_at  is 'Mirror sync time';

comment on table  clerk.clients                   is 'Clerk clients mirror';
comment on column clerk.clients.client_id          is 'Client id';
comment on column clerk.clients.user_id            is 'User id';
comment on column clerk.clients.last_active_at     is 'Last active time';
comment on column clerk.clients.created_at         is 'Clerk created_at';
comment on column clerk.clients.updated_at         is 'Clerk updated_at';
comment on column clerk.clients.sessions           is 'Sessions JSON';
comment on column clerk.clients.metadata           is 'Metadata JSON';
comment on column clerk.clients.synced_at          is 'Mirror sync time';

comment on table  clerk.organization_domains      is 'Clerk organization domains mirror';
comment on column clerk.organization_domains.organization_domain_id is 'Organization domain id';
comment on column clerk.organization_domains.organization_id is 'Organization id';
comment on column clerk.organization_domains.name  is 'Domain name';
comment on column clerk.organization_domains.verification is 'Verification JSON';
comment on column clerk.organization_domains.created_at is 'Clerk created_at';
comment on column clerk.organization_domains.updated_at is 'Clerk updated_at';
comment on column clerk.organization_domains.synced_at  is 'Mirror sync time';

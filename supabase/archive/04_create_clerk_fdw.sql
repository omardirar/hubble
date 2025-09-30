create extension if not exists wrappers
with
  schema extensions;

create foreign data wrapper wasm_wrapper handler wasm_fdw_handler validator wasm_fdw_validator;

create server clerk_server foreign data wrapper wasm_wrapper options (
  fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.2.0/clerk_fdw.wasm',
  fdw_package_name 'supabase:clerk-fdw',
  fdw_package_version '0.2.0',
  fdw_package_checksum '89337bb11779d4d654cd3e54391aabd02509d213db6995f7dd58951774bf0e37',
  api_url 'https://api.clerk.com/v1', -- optional
  api_key_id '204da3d9-fe29-4389-88d5-e7fe4d64822c'
);

create schema if not exists clerk;
create schema if not exists clerk_dev;

-- create all the foreign tables
import foreign schema clerk
from
  server clerk_server into clerk;

-- create all the foreign tables for dev schema
import foreign schema clerk
from
  server clerk_server into clerk_dev;

-- Restrictive: avoid exposing FDW tables via PostgREST by default
-- Create minimal views only if needed by app; otherwise, keep FDW tables non-exposed.
drop view if exists public.organization_memberships;
drop view if exists public.users;

-- Provide a safe, minimal view for membership lookup if required (commented out by default)
-- create view public.organization_memberships
--   with (security_invoker = true, security_barrier = true) as
-- select organization_id, user_id, role, created_at, updated_at
-- from clerk.organization_memberships;
-- grant select on public.organization_memberships to authenticated;

-- Simple existence RPC used by API handlers
-- This function dynamically checks the appropriate schema based on environment
create or replace function public.get_org_from_clerk_mirror(p_org_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_schema_name text;
  result boolean;
begin
  -- Determine schema based on environment
  -- Check if we should use dev schema by looking for a specific marker
  -- In development/preview, use clerk_dev; otherwise use clerk
  if current_setting('app.environment', true) in ('development', 'preview') or
     current_setting('app.environment', true) is null then
    v_schema_name := 'clerk_dev';
  else
    v_schema_name := 'clerk';
  end if;

  -- Check if organization exists in the appropriate schema
  execute format('select exists(select 1 from %I.organizations o where o.id = $1)', v_schema_name)
  using p_org_id
  into result;

  return result;
end;
$$;

alter function public.get_org_from_clerk_mirror(text) owner to postgres;

-- Ensure RPC and FDW access
-- Tighten FDW exposure: only service role gets direct access; app should call RPCs instead
revoke USAGE on foreign server clerk_server from public, anon, authenticated;
grant  USAGE on foreign server clerk_server to service_role;

revoke USAGE on schema clerk from public, anon, authenticated;
grant  USAGE on schema clerk to service_role;

revoke SELECT on all tables in schema clerk from public, anon, authenticated;
grant  SELECT on all tables in schema clerk to service_role;

-- Keep defaults locked down
alter default privileges in schema clerk revoke SELECT on tables from public, anon, authenticated;
alter default privileges in schema clerk grant  SELECT on tables to service_role;
grant execute on function public.get_org_from_clerk_mirror(text) to anon, authenticated, service_role;

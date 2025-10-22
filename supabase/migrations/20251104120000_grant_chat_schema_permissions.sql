-- Ensure the chat schema is accessible via Supabase data APIs.

grant usage on schema chat to anon, authenticated, service_role;
grant all on all tables in schema chat to anon, authenticated, service_role;
grant all on all routines in schema chat to anon, authenticated, service_role;
grant all on all sequences in schema chat to anon, authenticated, service_role;

alter default privileges for role postgres in schema chat
    grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema chat
    grant all on routines to anon, authenticated, service_role;

alter default privileges for role postgres in schema chat
    grant all on sequences to anon, authenticated, service_role;

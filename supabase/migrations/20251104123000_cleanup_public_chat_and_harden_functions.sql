-- Remove legacy chat tables from the public schema and harden security-sensitive functions.

-- Drop RPC that depended on legacy public tables before removing them.
drop function if exists public.rpc_append_message(uuid, text, jsonb, text);

-- Remove legacy chat tables that have been superseded by the chat schema.
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;

-- Add covering indexes for foreign keys flagged by database linting.
create index if not exists idx_chat_conversations_last_message_id
    on chat.conversations (last_message_id)
    where last_message_id is not null;

create index if not exists idx_chat_conversations_last_run_id
    on chat.conversations (last_run_id)
    where last_run_id is not null;

create index if not exists idx_chat_messages_conversation_fk
    on chat.messages (conversation_id);

create index if not exists idx_chat_usage_run_fk
    on chat.usage (run_id);

create index if not exists idx_connect_data_connections_org_fk
    on connect.data_connections (org_id);

create index if not exists idx_connect_data_connections_source_type_fk
    on connect.data_connections (source_type);

create index if not exists idx_core_provisioning_workflows_org_fk
    on core.provisioning_workflows (org_id);

create index if not exists idx_system_audit_events_org_fk
    on system.audit_events (org_id);

-- Harden chat helper functions by pinning search_path.
create or replace function chat.current_org_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    return coalesce(
        nullif(current_setting('request.jwt.claims', true)::json->>'org_id', '')::uuid,
        nullif(current_setting('app.current_org_id', true), '')::uuid
    );
end;
$$;

create or replace function chat.current_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    return coalesce(
        nullif(current_setting('request.jwt.claims', true)::json->>'user_id', '')::uuid,
        nullif(current_setting('app.current_user_id', true), '')::uuid
    );
end;
$$;

create or replace function chat.get_next_message_seq(p_conversation_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
    v_seq integer;
begin
    insert into chat.conversation_sequences (conversation_id, next_seq)
    values (p_conversation_id, 1)
    on conflict (conversation_id) do update
        set next_seq = chat.conversation_sequences.next_seq + 1,
            updated_at = timezone('utc', now())
    returning next_seq - 1 into v_seq;

    return v_seq;
end;
$$;

create or replace function chat.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

-- Harden public schema helper functions.
create or replace function public.block_update_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'Updates and deletes are not allowed on this table';
end;
$$;

create or replace function public.debug_jwt()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
    return auth.jwt();
exception
    when others then
        return '{"error": "Failed to get JWT"}'::jsonb;
end;
$$;

create or replace function public.ensure_tenant_exists(p_org_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $_$
declare
  v_rowcount integer;
  v_error_message text;
  v_schema_name text;
begin
  if exists (select 1 from core.organizations where org_id = p_org_id) then
    return;
  end if;

  if current_setting('app.environment', true) in ('development', 'preview') or
     current_setting('app.environment', true) is null then
    v_schema_name := 'clerk_dev';
  else
    v_schema_name := 'clerk';
  end if;

  begin
    execute format('
      INSERT INTO core.organizations (org_id, slug, status)
      SELECT
        o.id,
        coalesce(nullif(trim(o.slug), ''''), o.id),
        ''provisioning''::core.organization_status_t
      FROM %I.organizations o
      WHERE o.id = $1
      ON CONFLICT (org_id) DO UPDATE
        SET slug = excluded.slug', v_schema_name)
    using p_org_id;

    get diagnostics v_rowcount = row_count;
    if v_rowcount = 0 then
      raise exception 'Organization not found in Clerk' using errcode = 'P0001';
    end if;
  exception
    when others then
      get stacked diagnostics v_error_message = message_text;
      raise exception 'Failed to create organization: %', v_error_message using errcode = 'P0002';
  end;
end;
$_$;

create or replace function public.get_org_from_clerk_mirror(p_org_id text)
returns table(org_id text, slug text, name text)
language plpgsql
security definer
set search_path = ''
as $_$
declare
  v_schema_name text;
begin
  if current_setting('app.environment', true) in ('development', 'preview') or
     current_setting('app.environment', true) is null then
    v_schema_name := 'clerk_dev';
  else
    v_schema_name := 'clerk';
  end if;

  return query execute format('
    SELECT o.id, o.slug, o.name
    FROM %I.organizations o
    WHERE o.id = $1', v_schema_name)
  using p_org_id;
end;
$_$;

create or replace function public.get_secret(p_org_id text, p_secret_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
    return system.get_secret(p_org_id, p_secret_name);
end;
$$;

create or replace function public.jwt_claim(claim text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_payload jsonb;
begin
  jwt_payload := auth.jwt();

  case claim
    when 'sub' then
      return jwt_payload ->> 'sub';
    when 'org_id' then
      if jwt_payload ? 'org_id' then
        return jwt_payload ->> 'org_id';
      elsif jwt_payload ? 'o' and jsonb_typeof(jwt_payload -> 'o') = 'object' then
        return jwt_payload -> 'o' ->> 'id';
      else
        return null;
      end if;
    when 'org_role' then
      if jwt_payload ? 'org_role' then
        return jwt_payload ->> 'org_role';
      elsif jwt_payload ? 'o' and jsonb_typeof(jwt_payload -> 'o') = 'object' then
        return jwt_payload -> 'o' ->> 'rol';
      else
        return null;
      end if;
    when 'org_slug' then
      if jwt_payload ? 'org_slug' then
        return jwt_payload ->> 'org_slug';
      elsif jwt_payload ? 'o' and jsonb_typeof(jwt_payload -> 'o') = 'object' then
        return jwt_payload -> 'o' ->> 'slug';
      else
        return null;
      end if;
    else
      return jwt_payload ->> claim;
  end case;
exception
  when others then
    return null;
end;
$$;

create or replace function public.set_secret(p_org_id text, p_secret_name text, p_secret_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform system.set_secret(p_org_id, p_secret_name, p_secret_value);
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Harden core schema trigger helpers.
create or replace function core.block_slug_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
        raise exception 'slug updates are not allowed; create a new organization instead';
    end if;
    return new;
end;
$$;

-- Harden system schema secret helpers and triggers.
create or replace function system.delete_secret(p_org_id text, p_secret_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if p_org_id is null or p_org_id = '' then
    raise exception 'org_id cannot be null or empty' using errcode = 'P0001';
  end if;

  if p_secret_name is null or p_secret_name = '' then
    raise exception 'secret_name cannot be null or empty' using errcode = 'P0001';
  end if;

  delete from system.secrets
  where org_id = p_org_id
    and secret_name = p_secret_name;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

create or replace function system.get_md_sa_token(p_org_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return system.get_secret(p_org_id, 'md_sa_token');
end;
$$;

create or replace function system.get_secret(p_org_id text, p_secret_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_value text;
begin
  if p_org_id is null or p_org_id = '' then
    raise exception 'org_id cannot be null or empty' using errcode = 'P0001';
  end if;

  if p_secret_name is null or p_secret_name = '' then
    raise exception 'secret_name cannot be null or empty' using errcode = 'P0001';
  end if;

  select s.secret_value into secret_value
  from system.secrets s
  where s.org_id = p_org_id
    and s.secret_name = p_secret_name;

  return secret_value;
end;
$$;

create or replace function system.has_secret(p_org_id text, p_secret_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_exists boolean;
begin
  if p_org_id is null or p_org_id = '' then
    raise exception 'org_id cannot be null or empty' using errcode = 'P0001';
  end if;

  if p_secret_name is null or p_secret_name = '' then
    raise exception 'secret_name cannot be null or empty' using errcode = 'P0001';
  end if;

  select exists(
    select 1
    from system.secrets s
    where s.org_id = p_org_id
      and s.secret_name = p_secret_name
  ) into secret_exists;

  return secret_exists;
end;
$$;

create or replace function system.rate_limit_check(p_user_id text, p_action text, p_window interval, p_limit integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_start timestamptz := date_trunc('minute', now());
  v_window_start timestamptz := v_start - p_window + interval '1 minute';
  v_cnt int;
begin
  insert into system.rate_limits(user_id, action, window_start, count)
  values (p_user_id, p_action, v_start, 0)
  on conflict (user_id, action, window_start) do nothing;

  select coalesce(sum(count), 0)
    into v_cnt
  from system.rate_limits
  where user_id = p_user_id
    and action  = p_action
    and window_start >= v_window_start;

  if v_cnt >= p_limit then
    raise exception 'Rate limit exceeded for %', p_action using errcode = 'P0001';
  end if;

  update system.rate_limits
     set count = count + 1
   where user_id = p_user_id
     and action  = p_action
     and window_start = v_start;
end;
$$;

create or replace function system.set_audit_event_seq()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_next bigint;
begin
  if new.correlation_id is null then
    new.correlation_id := (gen_random_uuid())::text;
  end if;

  if new.event_seq is null then
    select coalesce(max(e.event_seq), 0) + 1
      into v_next
    from system.audit_events e
    where e.correlation_id = new.correlation_id;
    new.event_seq := v_next;
  end if;

  return new;
end;
$$;

create or replace function system.set_audit_events_created_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_on := (coalesce(new.created_at, now()) at time zone 'UTC')::date;
  return new;
end;
$$;

create or replace function system.set_md_sa_token(p_org_id text, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform system.set_secret(p_org_id, 'md_sa_token', p_token);
end;
$$;

create or replace function system.set_secret(p_org_id text, p_secret_name text, p_secret_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_org_id is null or p_org_id = '' then
    raise exception 'org_id cannot be null or empty' using errcode = 'P0001';
  end if;

  if p_secret_name is null or p_secret_name = '' then
    raise exception 'secret_name cannot be null or empty' using errcode = 'P0001';
  end if;

  if p_secret_value is null or p_secret_value = '' then
    raise exception 'secret_value cannot be null or empty' using errcode = 'P0001';
  end if;

  insert into system.secrets (org_id, secret_name, secret_value)
  values (p_org_id, p_secret_name, p_secret_value)
  on conflict (org_id, secret_name)
  do update set
    secret_value = excluded.secret_value,
    updated_at = now();
end;
$$;

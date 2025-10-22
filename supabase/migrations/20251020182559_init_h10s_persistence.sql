-- Initialize chat schema for the Growth Copilot persistence layer.

create schema if not exists chat;

create table if not exists chat.conversations (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null,
    user_id uuid not null,
    title text not null default 'New Chat',
    status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    last_message_id uuid,
    last_run_id uuid
);

create table if not exists chat.runs (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references chat.conversations(id) on delete cascade,
    crew_name text not null,
    crew_version text,
    status text not null check (status in ('running', 'complete', 'failed', 'cancelled')),
    content jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default timezone('utc', now()),
    completed_at timestamptz,
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists chat.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references chat.conversations(id) on delete cascade,
    run_id uuid references chat.runs(id) on delete set null,
    role text not null check (role in ('user', 'assistant')),
    seq integer not null,
    content jsonb not null default '{}'::jsonb,
    status text not null check (status in ('streaming', 'cancelled', 'complete', 'error')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (conversation_id, seq)
);

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'conversations_last_message_fk'
    ) then
        alter table chat.conversations
            add constraint conversations_last_message_fk
                foreign key (last_message_id) references chat.messages(id) on delete set null;
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'conversations_last_run_fk'
    ) then
        alter table chat.conversations
            add constraint conversations_last_run_fk
                foreign key (last_run_id) references chat.runs(id) on delete set null;
    end if;
end;
$$;

create table if not exists chat.usage (
    run_id uuid not null references chat.runs(id) on delete cascade,
    conversation_id uuid not null references chat.conversations(id) on delete cascade,
    org_id uuid not null,
    llm_provider text not null,
    llm_model text not null,
    tokens jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (run_id, llm_provider, llm_model)
);

create index if not exists idx_messages_conversation_seq on chat.messages (conversation_id, seq);
create index if not exists idx_runs_conversation on chat.runs (conversation_id);
create index if not exists idx_usage_conversation on chat.usage (conversation_id);

create or replace function chat.set_updated_at() returns trigger as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$ language plpgsql;

do $$
begin
    if not exists (
        select 1
        from pg_trigger
        where tgname = 'set_chat_conversations_updated_at'
    ) then
        create trigger set_chat_conversations_updated_at
            before update on chat.conversations
            for each row execute procedure chat.set_updated_at();
    end if;

    if not exists (
        select 1
        from pg_trigger
        where tgname = 'set_chat_messages_updated_at'
    ) then
        create trigger set_chat_messages_updated_at
            before update on chat.messages
            for each row execute procedure chat.set_updated_at();
    end if;

    if not exists (
        select 1
        from pg_trigger
        where tgname = 'set_chat_runs_updated_at'
    ) then
        create trigger set_chat_runs_updated_at
            before update on chat.runs
            for each row execute procedure chat.set_updated_at();
    end if;

    if not exists (
        select 1
        from pg_trigger
        where tgname = 'set_chat_usage_updated_at'
    ) then
        create trigger set_chat_usage_updated_at
            before update on chat.usage
            for each row execute procedure chat.set_updated_at();
    end if;
end;
$$;

-- TODO: add RLS policies to restrict access per org/user once API shape stabilises.

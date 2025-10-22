-- Row Level Security (RLS) policies for multi-tenant isolation

-- Enable RLS on all chat tables
alter table chat.conversations enable row level security;
alter table chat.messages enable row level security;
alter table chat.runs enable row level security;
alter table chat.usage enable row level security;

-- Helper function to get current org_id from JWT or session variable
create or replace function chat.current_org_id() returns uuid as $$
begin
    -- First try to get from JWT claims
    return coalesce(
        nullif(current_setting('request.jwt.claims', true)::json->>'org_id', '')::uuid,
        nullif(current_setting('app.current_org_id', true), '')::uuid
    );
end;
$$ language plpgsql security definer stable;

-- Helper function to get current user_id from JWT or session variable
create or replace function chat.current_user_id() returns uuid as $$
begin
    return coalesce(
        nullif(current_setting('request.jwt.claims', true)::json->>'user_id', '')::uuid,
        nullif(current_setting('app.current_user_id', true), '')::uuid
    );
end;
$$ language plpgsql security definer stable;

-- Conversations: Users can only access conversations in their org
create policy conversations_select_policy on chat.conversations
    for select
    using (org_id = chat.current_org_id());

create policy conversations_insert_policy on chat.conversations
    for insert
    with check (org_id = chat.current_org_id() and user_id = chat.current_user_id());

create policy conversations_update_policy on chat.conversations
    for update
    using (org_id = chat.current_org_id() and user_id = chat.current_user_id());

-- Messages: Users can access messages for conversations they own
create policy messages_select_policy on chat.messages
    for select
    using (
        exists (
            select 1 from chat.conversations
            where conversations.id = messages.conversation_id
              and conversations.org_id = chat.current_org_id()
        )
    );

create policy messages_insert_policy on chat.messages
    for insert
    with check (
        exists (
            select 1 from chat.conversations
            where conversations.id = messages.conversation_id
              and conversations.org_id = chat.current_org_id()
              and conversations.user_id = chat.current_user_id()
        )
    );

create policy messages_update_policy on chat.messages
    for update
    using (
        exists (
            select 1 from chat.conversations
            where conversations.id = messages.conversation_id
              and conversations.org_id = chat.current_org_id()
              and conversations.user_id = chat.current_user_id()
        )
    );

-- Runs: Users can access runs for their conversations
create policy runs_select_policy on chat.runs
    for select
    using (
        exists (
            select 1 from chat.conversations
            where conversations.id = runs.conversation_id
              and conversations.org_id = chat.current_org_id()
        )
    );

create policy runs_insert_policy on chat.runs
    for insert
    with check (
        exists (
            select 1 from chat.conversations
            where conversations.id = runs.conversation_id
              and conversations.org_id = chat.current_org_id()
              and conversations.user_id = chat.current_user_id()
        )
    );

create policy runs_update_policy on chat.runs
    for update
    using (
        exists (
            select 1 from chat.conversations
            where conversations.id = runs.conversation_id
              and conversations.org_id = chat.current_org_id()
              and conversations.user_id = chat.current_user_id()
        )
    );

-- Usage: Users can view usage for their org
create policy usage_select_policy on chat.usage
    for select
    using (org_id = chat.current_org_id());

create policy usage_insert_policy on chat.usage
    for insert
    with check (org_id = chat.current_org_id());

-- Grant service role bypass (for backend operations)
-- Service role should be able to bypass RLS for admin operations
comment on table chat.conversations is 'RLS enabled - service role bypasses policies';
comment on table chat.messages is 'RLS enabled - service role bypasses policies';
comment on table chat.runs is 'RLS enabled - service role bypasses policies';
comment on table chat.usage is 'RLS enabled - service role bypasses policies';

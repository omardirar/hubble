-- Add performance indexes for common query patterns

-- Index for querying conversations by org and user
create index if not exists idx_conversations_org_user
    on chat.conversations (org_id, user_id);

-- Index for querying conversations by org (for org-level stats)
create index if not exists idx_conversations_org
    on chat.conversations (org_id);

-- Index for querying messages by run_id (for run-specific messages)
create index if not exists idx_messages_run
    on chat.messages (run_id)
    where run_id is not null;

-- Index for querying runs by status (for monitoring)
create index if not exists idx_runs_status
    on chat.runs (status);

-- Index for querying runs by conversation and status
create index if not exists idx_runs_conversation_status
    on chat.runs (conversation_id, status);

-- Index for querying usage by org (for billing/analytics)
create index if not exists idx_usage_org
    on chat.usage (org_id);

-- Index for querying usage by date range (for analytics)
create index if not exists idx_usage_created
    on chat.usage (created_at desc);

-- Partial index for active conversations
create index if not exists idx_conversations_active
    on chat.conversations (updated_at desc)
    where status = 'active';

-- =============================================================================
-- Refined Schema: Chat and Messaging Features
-- =============================================================================
-- This migration creates the chat schema with improved table names and organization
-- for chat and messaging features.

-- Create chat schema
CREATE SCHEMA IF NOT EXISTS chat;

-- =============================================================================
-- Chat Tables
-- =============================================================================

-- Conversations table (moved from public.conversations)
CREATE TABLE IF NOT EXISTS chat.conversations (
  id             uuid primary key default extensions.gen_random_uuid(),
  org_id         text not null references core.organizations(org_id) on delete cascade,
  owner_user_id  text not null,
  title          text,
  status         text not null default 'active' check (status in ('active','archived')),
  archived_at    timestamptz,
  model          text,
  system_prompt  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_org ON chat.conversations (org_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_owner ON chat.conversations (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_org_updated ON chat.conversations (org_id, updated_at desc);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_org_owner_updated ON chat.conversations (org_id, owner_user_id, updated_at desc);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_org_updated_active ON chat.conversations (org_id, updated_at desc)
  WHERE archived_at IS NULL;

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_chat_conversations_set_updated_at ON chat.conversations;
CREATE TRIGGER trg_chat_conversations_set_updated_at
BEFORE UPDATE ON chat.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messages table (moved from public.messages)
CREATE TABLE IF NOT EXISTS chat.messages (
  id               uuid primary key default extensions.gen_random_uuid(),
  conversation_id  uuid not null references chat.conversations(id) on delete cascade,
  org_id           text not null,
  owner_user_id    text not null,
  author_user_id   text,
  role             text not null check (role in ('user','assistant','system','tool','function')),
  content          jsonb not null default '{}'::jsonb,
  text_content     text generated always as (
    case
      when jsonb_typeof(content) = 'string' then trim(both '"' from content::text)
      when content ? 'text' then content->>'text'
      else null
    end
  ) stored,
  model            text,
  tool_name        text,
  tool_call_id     text,
  error            text,
  idempotency_key  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org ON chat.messages (org_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org_owner_created ON chat.messages (org_id, owner_user_id, created_at asc);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created_ok ON chat.messages (conversation_id, created_at asc)
  WHERE error IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_org_role_time ON chat.messages (org_id, role, created_at desc);

-- Unique index for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_conversation_idempotency
  ON chat.messages (conversation_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_chat_messages_set_updated_at ON chat.messages;
CREATE TRIGGER trg_chat_messages_set_updated_at
BEFORE UPDATE ON chat.messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- Chat Functions
-- =============================================================================

-- Apply parent context to messages
CREATE OR REPLACE FUNCTION chat.messages_apply_parent_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_org   text;
  v_owner text;
BEGIN
  SELECT c.org_id, c.owner_user_id
    INTO v_org, v_owner
  FROM chat.conversations c
  WHERE c.id = NEW.conversation_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Conversation % not found', NEW.conversation_id;
  END IF;

  NEW.org_id := v_org;
  NEW.owner_user_id := v_owner;

  IF NEW.role = 'user' AND NEW.author_user_id IS NULL THEN
    NEW.author_user_id := v_owner;
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION chat.messages_apply_parent_context() SET search_path = pg_catalog, chat;

-- Touch conversation updated_at when message is inserted
CREATE OR REPLACE FUNCTION chat.touch_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE chat.conversations
     SET updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NULL;
END;
$$;
ALTER FUNCTION chat.touch_conversation_updated_at() SET search_path = pg_catalog, chat;

-- Block moving messages between conversations
CREATE OR REPLACE FUNCTION chat.block_message_move()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.conversation_id IS DISTINCT FROM NEW.conversation_id THEN
    RAISE EXCEPTION 'Updating conversation_id is not allowed';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION chat.block_message_move() SET search_path = pg_catalog, chat;

-- Check archive has messages
CREATE OR REPLACE FUNCTION chat.check_archive_has_messages()
RETURNS trigger
AS $$
BEGIN
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM chat.messages
      WHERE conversation_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot archive empty conversation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION chat.check_archive_has_messages() SET search_path = pg_catalog, chat;

-- =============================================================================
-- Chat Triggers
-- =============================================================================

-- Message triggers
DROP TRIGGER IF EXISTS trg_chat_messages_apply_parent_context_ins ON chat.messages;
CREATE TRIGGER trg_chat_messages_apply_parent_context_ins
BEFORE INSERT ON chat.messages
FOR EACH ROW EXECUTE FUNCTION chat.messages_apply_parent_context();

DROP TRIGGER IF EXISTS trg_chat_messages_apply_parent_context_upd ON chat.messages;
CREATE TRIGGER trg_chat_messages_apply_parent_context_upd
BEFORE UPDATE OF conversation_id ON chat.messages
FOR EACH ROW EXECUTE FUNCTION chat.messages_apply_parent_context();

DROP TRIGGER IF EXISTS trg_chat_messages_block_move ON chat.messages;
CREATE TRIGGER trg_chat_messages_block_move
BEFORE UPDATE OF conversation_id ON chat.messages
FOR EACH ROW EXECUTE FUNCTION chat.block_message_move();

DROP TRIGGER IF EXISTS trg_chat_messages_touch_parent_after_ins ON chat.messages;
CREATE TRIGGER trg_chat_messages_touch_parent_after_ins
AFTER INSERT ON chat.messages
FOR EACH ROW EXECUTE FUNCTION chat.touch_conversation_updated_at();

-- Conversation triggers
DROP TRIGGER IF EXISTS trg_chat_conversations_archive_guard ON chat.conversations;
CREATE TRIGGER trg_chat_conversations_archive_guard
BEFORE UPDATE OF archived_at ON chat.conversations
FOR EACH ROW EXECUTE FUNCTION chat.check_archive_has_messages();

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE chat.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat.messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
DROP POLICY IF EXISTS chat_conversations_select_own ON chat.conversations;
CREATE POLICY chat_conversations_select_own
ON chat.conversations
FOR SELECT
USING (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
);

DROP POLICY IF EXISTS chat_conversations_insert_self ON chat.conversations;
CREATE POLICY chat_conversations_insert_self
ON chat.conversations
FOR INSERT
WITH CHECK (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
);

DROP POLICY IF EXISTS chat_conversations_update_own ON chat.conversations;
CREATE POLICY chat_conversations_update_own
ON chat.conversations
FOR UPDATE
USING (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
)
WITH CHECK (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
);

DROP POLICY IF EXISTS chat_conversations_delete_own ON chat.conversations;
CREATE POLICY chat_conversations_delete_own
ON chat.conversations
FOR DELETE
USING (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
);

-- Messages policies
DROP POLICY IF EXISTS chat_messages_select_own ON chat.messages;
CREATE POLICY chat_messages_select_own
ON chat.messages
FOR SELECT
USING (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
  AND EXISTS (
    SELECT 1
    FROM chat.conversations c
    WHERE c.id = chat.messages.conversation_id
      AND c.owner_user_id = (SELECT public.jwt_claim('sub'))
      AND c.org_id = (SELECT public.jwt_claim('org_id'))
  )
);

DROP POLICY IF EXISTS chat_messages_insert_own ON chat.messages;
CREATE POLICY chat_messages_insert_own
ON chat.messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM chat.conversations c
    WHERE c.id = conversation_id
      AND c.owner_user_id = (SELECT public.jwt_claim('sub'))
      AND c.org_id = (SELECT public.jwt_claim('org_id'))
  )
);

DROP POLICY IF EXISTS chat_messages_update_own ON chat.messages;
CREATE POLICY chat_messages_update_own
ON chat.messages
FOR UPDATE
USING (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
  AND EXISTS (
    SELECT 1
    FROM chat.conversations c
    WHERE c.id = chat.messages.conversation_id
      AND c.owner_user_id = (SELECT public.jwt_claim('sub'))
      AND c.org_id = (SELECT public.jwt_claim('org_id'))
  )
)
WITH CHECK (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
);

DROP POLICY IF EXISTS chat_messages_delete_own ON chat.messages;
CREATE POLICY chat_messages_delete_own
ON chat.messages
FOR DELETE
USING (
  owner_user_id = (SELECT public.jwt_claim('sub'))
  AND org_id = (SELECT public.jwt_claim('org_id'))
  AND EXISTS (
    SELECT 1
    FROM chat.conversations c
    WHERE c.id = chat.messages.conversation_id
      AND c.owner_user_id = (SELECT public.jwt_claim('sub'))
      AND c.org_id = (SELECT public.jwt_claim('org_id'))
  )
);

-- =============================================================================
-- Views
-- =============================================================================

-- Conversation summaries view
DROP VIEW IF EXISTS chat.conversation_summaries;
CREATE VIEW chat.conversation_summaries
  WITH (security_invoker = true, security_barrier = true) AS
SELECT
  c.id,
  c.org_id,
  c.owner_user_id,
  c.title,
  c.model,
  c.archived_at,
  c.created_at,
  c.updated_at,
  (
    SELECT m.text_content
    FROM chat.messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ) AS last_message_text
FROM chat.conversations c;

-- =============================================================================
-- RPC Functions
-- =============================================================================

-- RPC append message function
CREATE OR REPLACE FUNCTION chat.rpc_append_message(
  p_conversation_id uuid,
  p_role text,
  p_content jsonb,
  p_idempotency_key text default null
)
RETURNS chat.messages
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_msg chat.messages;
  v_sub text;
  v_org text;
BEGIN
  v_sub := auth.jwt()->>'sub';
  v_org := public.jwt_claim('org_id');

  -- Verify organization exists in Clerk mirror
  IF public.get_org_from_clerk_mirror(v_org) IS NULL THEN
    RAISE EXCEPTION 'Organization % not found in Clerk mirror', v_org USING errcode = '42501';
  END IF;

  -- Optional rate limiting: 120 messages per 5 minutes per user
  PERFORM public.rate_limit_check(v_sub, 'append_message', interval '5 minutes', 120);

  IF p_role NOT IN ('user','assistant','system','tool','function') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role USING errcode = '22023';
  END IF;

  IF pg_column_size(p_content) > 64 * 1024 THEN
    RAISE EXCEPTION 'Content too large' USING errcode = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM chat.conversations c
    WHERE c.id = p_conversation_id
      AND c.owner_user_id = v_sub
      AND c.org_id = v_org
  ) THEN
    RAISE EXCEPTION 'Conversation not found or not owned by caller' USING errcode = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN
    INSERT INTO chat.messages (conversation_id, org_id, owner_user_id, role, content)
    VALUES (p_conversation_id, v_org, v_sub, p_role, p_content)
    RETURNING * INTO v_msg;
  ELSE
    INSERT INTO chat.messages (conversation_id, org_id, owner_user_id, role, content, idempotency_key)
    VALUES (p_conversation_id, v_org, v_sub, p_role, p_content, p_idempotency_key)
    ON CONFLICT (conversation_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
    DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
    RETURNING * INTO v_msg;
  END IF;

  RETURN v_msg;
END;
$$;
ALTER FUNCTION chat.rpc_append_message(uuid, text, jsonb, text)
  SET search_path = pg_catalog, chat;

-- =============================================================================
-- Permissions
-- =============================================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA chat TO authenticated;
GRANT SELECT ON TABLE chat.conversations TO authenticated;
GRANT INSERT ON TABLE chat.conversations TO authenticated;
GRANT UPDATE ON TABLE chat.conversations TO authenticated;
GRANT DELETE ON TABLE chat.conversations TO authenticated;
GRANT SELECT ON TABLE chat.messages TO authenticated;
GRANT INSERT ON TABLE chat.messages TO authenticated;
GRANT UPDATE ON TABLE chat.messages TO authenticated;
GRANT DELETE ON TABLE chat.messages TO authenticated;
GRANT SELECT ON TABLE chat.conversation_summaries TO authenticated;
GRANT EXECUTE ON FUNCTION chat.rpc_append_message(uuid, text, jsonb, text) TO authenticated;

-- Grant permissions to service_role
GRANT USAGE ON SCHEMA chat TO service_role;
GRANT ALL ON TABLE chat.conversations TO service_role;
GRANT ALL ON TABLE chat.messages TO service_role;
GRANT SELECT ON TABLE chat.conversation_summaries TO service_role;
GRANT EXECUTE ON FUNCTION chat.rpc_append_message(uuid, text, jsonb, text) TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON SCHEMA chat IS 'Chat and messaging features including conversations and messages';
COMMENT ON TABLE chat.conversations IS 'Chat conversations per organization and user';
COMMENT ON TABLE chat.messages IS 'Chat messages within conversations';

COMMENT ON COLUMN chat.conversations.id IS 'Conversation id';
COMMENT ON COLUMN chat.conversations.org_id IS 'Owning organization id';
COMMENT ON COLUMN chat.conversations.owner_user_id IS 'Owner user id (Clerk sub)';
COMMENT ON COLUMN chat.conversations.title IS 'Conversation title';
COMMENT ON COLUMN chat.conversations.model IS 'Model used for this conversation';
COMMENT ON COLUMN chat.conversations.system_prompt IS 'System prompt text';
COMMENT ON COLUMN chat.conversations.archived_at IS 'Archive timestamp (null if active)';

COMMENT ON COLUMN chat.messages.id IS 'Message id';
COMMENT ON COLUMN chat.messages.conversation_id IS 'FK to conversation';
COMMENT ON COLUMN chat.messages.org_id IS 'Owning organization id (denormalized)';
COMMENT ON COLUMN chat.messages.owner_user_id IS 'Owner user id (denormalized)';
COMMENT ON COLUMN chat.messages.role IS 'Message role (user, assistant, system, tool, function)';
COMMENT ON COLUMN chat.messages.content IS 'Message content (JSON)';
COMMENT ON COLUMN chat.messages.text_content IS 'Plain text extraction for search/snippets';
COMMENT ON COLUMN chat.messages.model IS 'Model returned/used for message';
COMMENT ON COLUMN chat.messages.tool_name IS 'Tool name used (if any)';
COMMENT ON COLUMN chat.messages.tool_call_id IS 'Tool call id (if any)';
COMMENT ON COLUMN chat.messages.error IS 'Error text if generation failed';
COMMENT ON COLUMN chat.messages.idempotency_key IS 'Idempotency key for retries';

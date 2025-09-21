-- Chat feature schema: conversations and messages with RLS.

CREATE TABLE IF NOT EXISTS public.conversations (
  id             uuid primary key default extensions.gen_random_uuid(),
  org_id         text not null references public.tenants(org_id) on delete cascade,
  owner_user_id  text not null,
  title          text,
  status         text not null default 'active' check (status in ('active','archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Additional conversation metadata aligned with API contracts
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS system_prompt text;

CREATE INDEX IF NOT EXISTS idx_conversations_org   ON public.conversations (org_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON public.conversations (owner_user_id);

DROP TRIGGER IF EXISTS trg_conversations_set_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_set_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid primary key default extensions.gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  org_id           text not null,
  author_user_id   text,
  role             text not null,
  body             jsonb not null,
  text_content     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Expanded message metadata and compatibility columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS owner_user_id   text,
  ADD COLUMN IF NOT EXISTS content         jsonb not null default '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS model           text,
  ADD COLUMN IF NOT EXISTS tool_name       text,
  ADD COLUMN IF NOT EXISTS tool_call_id    text,
  ADD COLUMN IF NOT EXISTS error           text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Body is legacy; make it optional with a safe default for back-compat
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'body'
  ) THEN
    EXECUTE 'ALTER TABLE public.messages ALTER COLUMN body DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.messages ALTER COLUMN body SET DEFAULT ''{}''::jsonb';
  END IF;
END$$;

-- Ensure role allows tool/function in addition to core roles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'messages' AND constraint_name = 'messages_role_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.messages DROP CONSTRAINT messages_role_check';
  END IF;
END$$;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_role_check CHECK (role in ('user','assistant','system','tool','function'));

CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_org  ON public.messages (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_idem ON public.messages (conversation_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.messages_apply_parent_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_org   text;
  v_owner text;
BEGIN
  SELECT c.org_id, c.owner_user_id
    INTO v_org, v_owner
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  NEW.org_id := v_org;
  NEW.owner_user_id := v_owner;

  IF NEW.role = 'user' AND NEW.author_user_id IS NULL THEN
    NEW.author_user_id := v_owner;
  END IF;

  -- Prefer content, fallback to legacy body for back-compat
  IF NEW.text_content IS NULL THEN
    NEW.text_content := coalesce(NEW.content->>'text', NEW.body->>'text', NEW.content::text, NEW.body::text);
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION public.messages_apply_parent_context() SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS trg_messages_parent_context ON public.messages;
CREATE TRIGGER trg_messages_parent_context
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_apply_parent_context();

DROP TRIGGER IF EXISTS trg_messages_set_updated_at ON public.messages;
CREATE TRIGGER trg_messages_set_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_select_org ON public.conversations;
DROP POLICY IF EXISTS conversations_select_owner_or_org ON public.conversations;
CREATE POLICY conversations_select_owner_or_org
  ON public.conversations FOR SELECT
  USING (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    OR org_id = (SELECT public.current_org_id())
  );

DROP POLICY IF EXISTS conversations_modify_owner ON public.conversations;
CREATE POLICY conversations_modify_owner
  ON public.conversations FOR UPDATE
  USING (owner_user_id = (SELECT public.jwt_claim('sub')) AND org_id = (SELECT public.current_org_id()))
  WITH CHECK (owner_user_id = (SELECT public.jwt_claim('sub')) AND org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS conversations_insert_owner ON public.conversations;
CREATE POLICY conversations_insert_owner
  ON public.conversations FOR INSERT
  WITH CHECK (
    owner_user_id = (SELECT public.jwt_claim('sub')) AND org_id = (SELECT public.current_org_id())
  );

DROP POLICY IF EXISTS messages_select_org ON public.messages;
DROP POLICY IF EXISTS messages_select_owner_or_org ON public.messages;
CREATE POLICY messages_select_owner_or_org
  ON public.messages FOR SELECT
  USING (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    OR org_id = (SELECT public.current_org_id())
  );

DROP POLICY IF EXISTS messages_insert_org ON public.messages;
CREATE POLICY messages_insert_org
  ON public.messages FOR INSERT
  WITH CHECK (org_id = (SELECT public.current_org_id()));

-- Conversation summaries view for conversation listing (security-invoker)
DROP VIEW IF EXISTS public.conversation_summaries;
CREATE VIEW public.conversation_summaries
  WITH (security_invoker = true, security_barrier = true) AS
SELECT
  c.id,
  c.title,
  c.updated_at,
  c.archived_at,
  (
    SELECT m.content->>'text'
    FROM public.messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) AS last_message_text
FROM public.conversations c;

-- Grant read access to authenticated users
GRANT SELECT ON public.conversation_summaries TO authenticated;

-- Ensure schema/table grants so security-invoker view can resolve underlying tables
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.conversations TO authenticated;
GRANT INSERT ON TABLE public.conversations TO authenticated;
GRANT UPDATE ON TABLE public.conversations TO authenticated;
GRANT SELECT ON TABLE public.messages TO authenticated;
GRANT INSERT ON TABLE public.messages TO authenticated;

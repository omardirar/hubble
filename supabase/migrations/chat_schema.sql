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
  role             text not null check (role in ('user','assistant','system')),
  body             jsonb not null,
  text_content     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_org  ON public.messages (org_id);

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

  IF NEW.role = 'user' AND NEW.author_user_id IS NULL THEN
    NEW.author_user_id := v_owner;
  END IF;

  IF NEW.text_content IS NULL THEN
    NEW.text_content := coalesce(NEW.body->>'text', NEW.body::text);
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
CREATE POLICY conversations_select_org
  ON public.conversations FOR SELECT
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS conversations_modify_owner ON public.conversations;
CREATE POLICY conversations_modify_owner
  ON public.conversations FOR UPDATE
  USING (owner_user_id = auth.uid()::text)
  WITH CHECK (owner_user_id = auth.uid()::text);

DROP POLICY IF EXISTS messages_select_org ON public.messages;
CREATE POLICY messages_select_org
  ON public.messages FOR SELECT
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS messages_insert_org ON public.messages;
CREATE POLICY messages_insert_org
  ON public.messages FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

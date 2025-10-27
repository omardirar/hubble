-- H10S Agents Schema Migration
-- Purpose: Add dedicated schema for agent interactions (threads, messages, runs)
-- with multi-tenant RLS using Clerk org_id

-- Create h10s schema
CREATE SCHEMA IF NOT EXISTS h10s;

ALTER SCHEMA h10s OWNER TO postgres;

COMMENT ON SCHEMA h10s IS 'H10S agent interactions (threads, messages, runs) with multi-tenant isolation';

-- Create threads table
CREATE TABLE IF NOT EXISTS h10s.threads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id text NOT NULL,
  owner_user_id text NOT NULL,
  title text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT chk_h10s_threads_org_id_nonempty CHECK (length(org_id) > 0),
  CONSTRAINT chk_h10s_threads_owner_user_id_nonempty CHECK (length(owner_user_id) > 0)
);

ALTER TABLE h10s.threads OWNER TO postgres;

COMMENT ON TABLE h10s.threads IS 'Agent conversation threads with org/user isolation';

-- Create messages table
CREATE TABLE IF NOT EXISTS h10s.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES h10s.threads(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  author_user_id text,
  role text NOT NULL,
  content jsonb DEFAULT '{}'::jsonb NOT NULL,
  text_content text GENERATED ALWAYS AS (
    CASE
      WHEN jsonb_typeof(content) = 'string' THEN TRIM(BOTH '"' FROM content::text)
      WHEN content ? 'text' THEN content->>'text'
      ELSE NULL
    END
  ) STORED,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT chk_h10s_messages_org_id_nonempty CHECK (length(org_id) > 0),
  CONSTRAINT chk_h10s_messages_role_valid CHECK (role IN ('user', 'assistant', 'tool', 'system', 'function'))
);

ALTER TABLE h10s.messages OWNER TO postgres;

COMMENT ON TABLE h10s.messages IS 'Messages within agent threads';

-- Create runs table
CREATE TABLE IF NOT EXISTS h10s.runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES h10s.threads(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT chk_h10s_runs_org_id_nonempty CHECK (length(org_id) > 0),
  CONSTRAINT chk_h10s_runs_status_valid CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

ALTER TABLE h10s.runs OWNER TO postgres;

COMMENT ON TABLE h10s.runs IS 'Agent execution runs linked to threads';

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_h10s_threads_org_created ON h10s.threads(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_h10s_threads_org_owner ON h10s.threads(org_id, owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_h10s_threads_owner ON h10s.threads(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_h10s_messages_thread_created ON h10s.messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_h10s_messages_org ON h10s.messages(org_id);
CREATE INDEX IF NOT EXISTS idx_h10s_messages_role ON h10s.messages(role);

CREATE INDEX IF NOT EXISTS idx_h10s_runs_thread ON h10s.runs(thread_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_h10s_runs_org_status ON h10s.runs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_h10s_runs_status ON h10s.runs(status) WHERE status IN ('pending', 'running');

-- Add foreign key constraints (org_id references core.organizations)
ALTER TABLE h10s.threads
  ADD CONSTRAINT threads_org_id_fkey FOREIGN KEY (org_id) REFERENCES core.organizations(org_id) ON DELETE CASCADE;

ALTER TABLE h10s.messages
  ADD CONSTRAINT messages_org_id_fkey FOREIGN KEY (org_id) REFERENCES core.organizations(org_id) ON DELETE CASCADE;

ALTER TABLE h10s.runs
  ADD CONSTRAINT runs_org_id_fkey FOREIGN KEY (org_id) REFERENCES core.organizations(org_id) ON DELETE CASCADE;

-- Add triggers for updated_at
CREATE OR REPLACE TRIGGER trg_h10s_threads_set_updated_at
  BEFORE UPDATE ON h10s.threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE h10s.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE h10s.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE h10s.runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for threads (owner-only access)
CREATE POLICY threads_select_own ON h10s.threads
  FOR SELECT
  USING (
    owner_user_id = public.jwt_claim('sub')
    AND org_id = public.jwt_claim('org_id')
  );

CREATE POLICY threads_insert_self ON h10s.threads
  FOR INSERT
  WITH CHECK (
    owner_user_id = public.jwt_claim('sub')
    AND org_id = public.jwt_claim('org_id')
  );

CREATE POLICY threads_update_own ON h10s.threads
  FOR UPDATE
  USING (
    owner_user_id = public.jwt_claim('sub')
    AND org_id = public.jwt_claim('org_id')
  )
  WITH CHECK (
    owner_user_id = public.jwt_claim('sub')
    AND org_id = public.jwt_claim('org_id')
  );

CREATE POLICY threads_delete_own ON h10s.threads
  FOR DELETE
  USING (
    owner_user_id = public.jwt_claim('sub')
    AND org_id = public.jwt_claim('org_id')
  );

-- RLS Policies for messages (thread-owner access)
CREATE POLICY messages_select_own ON h10s.messages
  FOR SELECT
  USING (
    org_id = public.jwt_claim('org_id')
    AND EXISTS (
      SELECT 1 FROM h10s.threads t
      WHERE t.id = messages.thread_id
      AND t.owner_user_id = public.jwt_claim('sub')
      AND t.org_id = public.jwt_claim('org_id')
    )
  );

CREATE POLICY messages_insert_own ON h10s.messages
  FOR INSERT
  WITH CHECK (
    org_id = public.jwt_claim('org_id')
    AND EXISTS (
      SELECT 1 FROM h10s.threads t
      WHERE t.id = messages.thread_id
      AND t.owner_user_id = public.jwt_claim('sub')
      AND t.org_id = public.jwt_claim('org_id')
    )
  );

-- RLS Policies for runs (thread-owner access)
CREATE POLICY runs_select_own ON h10s.runs
  FOR SELECT
  USING (
    org_id = public.jwt_claim('org_id')
    AND EXISTS (
      SELECT 1 FROM h10s.threads t
      WHERE t.id = runs.thread_id
      AND t.owner_user_id = public.jwt_claim('sub')
      AND t.org_id = public.jwt_claim('org_id')
    )
  );

CREATE POLICY runs_insert_own ON h10s.runs
  FOR INSERT
  WITH CHECK (
    org_id = public.jwt_claim('org_id')
    AND EXISTS (
      SELECT 1 FROM h10s.threads t
      WHERE t.id = runs.thread_id
      AND t.owner_user_id = public.jwt_claim('sub')
      AND t.org_id = public.jwt_claim('org_id')
    )
  );

-- Service role policies (bypass RLS)
CREATE POLICY threads_service_role ON h10s.threads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY messages_service_role ON h10s.messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY runs_service_role ON h10s.runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT USAGE ON SCHEMA h10s TO authenticated;
GRANT USAGE ON SCHEMA h10s TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE h10s.threads TO authenticated;
GRANT ALL ON TABLE h10s.threads TO service_role;

GRANT SELECT, INSERT ON TABLE h10s.messages TO authenticated;
GRANT ALL ON TABLE h10s.messages TO service_role;

GRANT SELECT, INSERT ON TABLE h10s.runs TO authenticated;
GRANT ALL ON TABLE h10s.runs TO service_role;

-- Create public views for client access (optional, respects RLS)
CREATE OR REPLACE VIEW public.h10s_threads WITH (security_invoker = true) AS
  SELECT id, org_id, owner_user_id, title, metadata, created_at, updated_at
  FROM h10s.threads;

ALTER VIEW public.h10s_threads OWNER TO postgres;

CREATE OR REPLACE VIEW public.h10s_messages WITH (security_invoker = true) AS
  SELECT id, thread_id, org_id, author_user_id, role, content, text_content, metadata, created_at
  FROM h10s.messages;

ALTER VIEW public.h10s_messages OWNER TO postgres;

CREATE OR REPLACE VIEW public.h10s_runs WITH (security_invoker = true) AS
  SELECT id, thread_id, org_id, status, started_at, finished_at, error, metadata
  FROM h10s.runs;

ALTER VIEW public.h10s_runs OWNER TO postgres;

-- Grant view access
GRANT SELECT ON public.h10s_threads TO authenticated;
GRANT ALL ON public.h10s_threads TO service_role;

GRANT SELECT ON public.h10s_messages TO authenticated;
GRANT ALL ON public.h10s_messages TO service_role;

GRANT SELECT ON public.h10s_runs TO authenticated;
GRANT ALL ON public.h10s_runs TO service_role;

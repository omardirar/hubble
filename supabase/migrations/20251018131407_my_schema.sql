alter table "public"."messages" drop constraint "messages_role_check";

drop index if exists "public"."idx_public_messages_conversation_created_ok";

drop index if exists "public"."idx_public_messages_org_role_time";

drop index if exists "public"."uq_public_messages_conversation_idempotency";

create table "public"."agent_runs" (
    "id" uuid not null default gen_random_uuid(),
    "run_id" uuid not null,
    "parent_run_id" uuid,
    "org_id" text not null,
    "user_id" text not null,
    "conversation_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "status" text not null,
    "stop_reason" text,
    "model" jsonb not null,
    "usage" jsonb not null default '{}'::jsonb,
    "provider_request_id" text,
    "provider_response_id" text,
    "trace_id" text,
    "span_id" text,
    "routing" jsonb,
    "policy" jsonb,
    "tools" jsonb default '[]'::jsonb,
    "mcp" jsonb default '[]'::jsonb,
    "error" jsonb,
    "artifacts" jsonb default '[]'::jsonb,
    "schema_version" text not null default '1.0'::text,
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."agent_runs" enable row level security;

-- Drop dependent column first (text_content depends on content)
alter table "public"."messages" drop column "text_content";

alter table "public"."messages" drop column "content";

alter table "public"."messages" drop column "error";

alter table "public"."messages" drop column "idempotency_key";

alter table "public"."messages" drop column "metadata";

alter table "public"."messages" drop column "model";

alter table "public"."messages" drop column "role";

alter table "public"."messages" drop column "tool_call_id";

alter table "public"."messages" drop column "tool_name";

alter table "public"."messages" add column "agent_run_id" uuid;

alter table "public"."messages" add column "agents" jsonb default '[]'::jsonb;

alter table "public"."messages" add column "events" jsonb default '[]'::jsonb;

alter table "public"."messages" add column "mcp_info" jsonb;

alter table "public"."messages" add column "messages_envelope" jsonb;

alter table "public"."messages" add column "output" jsonb;

alter table "public"."messages" add column "policy" jsonb;

alter table "public"."messages" add column "request_info" jsonb;

alter table "public"."messages" add column "routing" jsonb;

alter table "public"."messages" add column "run_info" jsonb;

alter table "public"."messages" add column "schema_version" text;

alter table "public"."messages" add column "usage" jsonb default '{}'::jsonb;

CREATE UNIQUE INDEX agent_runs_pkey ON public.agent_runs USING btree (id);

CREATE UNIQUE INDEX agent_runs_run_id_key ON public.agent_runs USING btree (run_id);

CREATE INDEX idx_agent_runs_conversation_id ON public.agent_runs USING btree (conversation_id);

CREATE INDEX idx_agent_runs_created_at ON public.agent_runs USING btree (created_at DESC);

CREATE INDEX idx_agent_runs_org_id ON public.agent_runs USING btree (org_id);

CREATE INDEX idx_agent_runs_parent_run_id ON public.agent_runs USING btree (parent_run_id);

CREATE INDEX idx_agent_runs_run_id ON public.agent_runs USING btree (run_id);

CREATE INDEX idx_agent_runs_status ON public.agent_runs USING btree (status);

CREATE INDEX idx_agent_runs_user_id ON public.agent_runs USING btree (user_id);

CREATE INDEX idx_messages_agent_run_id ON public.messages USING btree (agent_run_id);

alter table "public"."agent_runs" add constraint "agent_runs_pkey" PRIMARY KEY using index "agent_runs_pkey";

alter table "public"."agent_runs" add constraint "agent_runs_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) not valid;

alter table "public"."agent_runs" validate constraint "agent_runs_conversation_id_fkey";

alter table "public"."agent_runs" add constraint "agent_runs_duration_ms_check" CHECK ((duration_ms >= 0)) not valid;

alter table "public"."agent_runs" validate constraint "agent_runs_duration_ms_check";

alter table "public"."agent_runs" add constraint "agent_runs_org_id_fkey" FOREIGN KEY (org_id) REFERENCES core.organizations(org_id) not valid;

alter table "public"."agent_runs" validate constraint "agent_runs_org_id_fkey";

alter table "public"."agent_runs" add constraint "agent_runs_run_id_key" UNIQUE using index "agent_runs_run_id_key";

alter table "public"."agent_runs" add constraint "agent_runs_span_id_check" CHECK ((span_id ~ '^[0-9a-f]{16}$'::text)) not valid;

alter table "public"."agent_runs" validate constraint "agent_runs_span_id_check";

alter table "public"."agent_runs" add constraint "agent_runs_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."agent_runs" validate constraint "agent_runs_status_check";

alter table "public"."agent_runs" add constraint "agent_runs_stop_reason_check" CHECK ((stop_reason = ANY (ARRAY['end_turn'::text, 'max_tokens'::text, 'stop_sequence'::text, 'tool_call'::text, 'error'::text, 'other'::text]))) not valid;

alter table "public"."agent_runs" validate constraint "agent_runs_stop_reason_check";

alter table "public"."agent_runs" add constraint "agent_runs_trace_id_check" CHECK ((trace_id ~ '^[0-9a-f]{32}$'::text)) not valid;

alter table "public"."agent_runs" validate constraint "agent_runs_trace_id_check";

alter table "public"."messages" add constraint "messages_agent_run_id_fkey" FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL not valid;

alter table "public"."messages" validate constraint "messages_agent_run_id_fkey";

grant delete on table "public"."agent_runs" to "anon";

grant insert on table "public"."agent_runs" to "anon";

grant references on table "public"."agent_runs" to "anon";

grant select on table "public"."agent_runs" to "anon";

grant trigger on table "public"."agent_runs" to "anon";

grant truncate on table "public"."agent_runs" to "anon";

grant update on table "public"."agent_runs" to "anon";

grant delete on table "public"."agent_runs" to "authenticated";

grant insert on table "public"."agent_runs" to "authenticated";

grant references on table "public"."agent_runs" to "authenticated";

grant select on table "public"."agent_runs" to "authenticated";

grant trigger on table "public"."agent_runs" to "authenticated";

grant truncate on table "public"."agent_runs" to "authenticated";

grant update on table "public"."agent_runs" to "authenticated";

grant delete on table "public"."agent_runs" to "service_role";

grant insert on table "public"."agent_runs" to "service_role";

grant references on table "public"."agent_runs" to "service_role";

grant select on table "public"."agent_runs" to "service_role";

grant trigger on table "public"."agent_runs" to "service_role";

grant truncate on table "public"."agent_runs" to "service_role";

grant update on table "public"."agent_runs" to "service_role";

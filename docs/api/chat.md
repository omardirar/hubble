# Chat Features and API

This document describes the chat system used by the application, including authentication, database schema, REST endpoints, client flows, and future enhancements.

## Authentication

All client requests go through the Web App API routes which now proxy to the API Worker. The Web App attaches a Clerk session JWT (using the `supabase` template) as a Bearer token to the API Worker. The API Worker is the only service that talks to Supabase and it uses the Secrets Store for credentials. Row‑level security derives tenancy from JWT claims and ignores client‑supplied tenancy fields.

Headers:

- Client → Web App: standard fetch
- Web App → API Worker: `Authorization: Bearer <Clerk RS256 JWT (supabase template)>`
- API Worker → Supabase: `Authorization: Bearer <Clerk RS256 JWT>`, `apikey: <Supabase anon key>`, `content-type: application/json`

Required JWT claims:

- `sub` – Clerk user id
- `org_id` – active organization id

## Database Schema

### public.conversations

Columns: `id uuid`, `org_id text`, `owner_user_id text`, `title text`, `model text`, `system_prompt text`, `archived_at timestamptz`, `created_at`, `updated_at`

- `updated_at` is bumped via trigger when new messages arrive.
- RLS policies restrict access to the active org and current user.

### public.messages

Columns: `id uuid`, `conversation_id uuid`, `org_id text`, `owner_user_id text`, `role text`, `content jsonb`, `text_content generated`, `idempotency_key text`, timestamps.

- Triggers copy tenancy fields from the parent conversation and touch `conversations.updated_at` after insert.
- Partial unique index `(conversation_id, idempotency_key) WHERE idempotency_key IS NOT NULL` enforces idempotency.

### Views

`chat.conversations` – includes conversation details; used by the sidebar to show recent chats.

### RPCs

`public.rpc_append_message(p_conversation_id uuid, p_role text, p_content jsonb, p_idempotency_key text)` – inserts a message; idempotent when `p_idempotency_key` is provided.

## API Routes

Web routes are under `/api/v1/chat/*` and proxy to the API Worker `/v1/chat/*`.

### GET /api/chat/conversations

Returns visible (non‑archived) conversations for the current user/org ordered by `updated_at desc`.

Response:
`Array<{ id: string; title: string; updated_at: string; archived_at: string | null; last_message_text?: string }>`

### POST /api/chat/conversations

Creates a new conversation.

Body: `{ title?: string }`

Response: `{ id: string; title: string; ... }`

### PATCH /api/chat/conversations/:id

Updates a conversation's title or archive status.

Body: `{ title?: string; archived?: boolean }`

Response: updated conversation record.

### GET /api/chat/messages/:conversationId

Fetches messages for a conversation ordered by `created_at asc, id asc`. Response normalizes `content` to `{ text }`.

Response: `Array<{ id: string; role: 'user' | 'assistant' | 'system'; text: string }>`

### POST /api/chat/messages/:conversationId

Appends a message via the RPC.

Body:

```json
{ "role": "user", "text": "Hello", "idempotencyKey": "uuid-..." }
```

Response: inserted message row. Retries with the same `idempotencyKey` are safe; server retries once without the key on specific 400s.

## Client Flows

- **Draft new chat** – Clicking "New Chat" enters draft mode. The first send creates a conversation with a UNIX timestamp title, appends the message, then refreshes transcript and sidebar.
- **Subsequent sends** – Calls the RPC directly and refreshes transcript; sidebar revalidates so the active conversation jumps to the top.
- **Sidebar** – Fetches `/api/chat/conversations` and sorts by `updated_at desc`. Active conversation is highlighted. Dropdown actions include Rename and Archive.
- **Transcript** – Uses AI elements to render messages ascending by time.
- **Composer** – Built from `PromptInput*` elements, supports Enter submit and Shift+Enter newline.

## MCP Tooling

When `POST /api/v1/chat` runs, it attempts to connect to the MotherDuck MCP server. The route pulls
credentials per-tenant by calling `system.get_secret(org_id, 'md_sa_token')` and reading
`md_db_name` from `connect.data_destinations`. Those values become the `Authorization` and
`X-Db-Name` headers for the SSE transport at `https://mcp.hubble.systems/motherduck` in production
(`http://127.0.0.1:9001/` in development).

For local testing without Supabase access you can supply overrides via environment variables:

```env
MCP_MOTHERDUCK_URL=
MCP_MOTHERDUCK_SERVICE_SECRET=
MCP_MOTHERDUCK_CONNECTION=
MCP_MOTHERDUCK_BEARER_TOKEN=
MCP_MOTHERDUCK_DATABASE=
```

If neither Supabase secrets nor overrides are present, the chat flow skips MCP tool calls and
logs the absence for observability.

## Errors and Observability

- 401/403 responses surface a Sonner toast: "Check you're signed in and in the correct workspace."
- Client logs: `conversation_created`, `message_sent`, `sidebar_refreshed`.

## Future Work

- Sidebar pagination or a "More" button to load older conversations.
- Transcript pagination / "load older messages" feature.
- Generate AI titles after the first assistant reply.
- Stream assistant replies via WebSockets or SSE for real‑time updates.
- Replace manual fetches with React Query for caching, retries, and background refreshes.

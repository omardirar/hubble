# Chat Features and API

This document describes the chat system used by the application, including authentication, database schema, REST endpoints, client flows, and future enhancements.

## Authentication

All requests to Supabase are proxied through Next.js API routes that attach a Clerk session JWT (using the `supabase` template) as a Bearer token. Row‑level security derives tenancy from JWT claims and ignores client‑supplied tenancy fields.

Headers (server → Supabase):

- `Authorization: Bearer <Clerk RS256 JWT (supabase template)>`
- `apikey: <Supabase anon key>`
- `content-type: application/json`

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

`public.conversation_summaries` – includes `last_message_text`; used by the sidebar to show recent chats.

### RPCs

`public.rpc_append_message(p_conversation_id uuid, p_role text, p_content jsonb, p_idempotency_key text)` – inserts a message; idempotent when `p_idempotency_key` is provided.

## API Routes

All chat routes are namespaced under `/api/chat/*`.

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

## Errors and Observability

- 401/403 responses surface a Sonner toast: "Check you're signed in and in the correct workspace."
- Client logs: `conversation_created`, `message_sent`, `sidebar_refreshed`.

## Future Work

- Sidebar pagination or a "More" button to load older conversations.
- Transcript pagination / "load older messages" feature.
- Generate AI titles after the first assistant reply.
- Stream assistant replies via WebSockets or SSE for real‑time updates.
- Replace manual fetches with React Query for caching, retries, and background refreshes.

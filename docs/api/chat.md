# Chat APIs and Features

This document describes the chat features and HTTP APIs used by the application. It covers authentication, data model, endpoints, UI flows, and operational notes.

## Authentication & RLS

All requests to Supabase are proxied through our Next.js API routes which attach a Clerk session JWT (via a dedicated `supabase` JWT template) as a Bearer token. Row-Level Security (RLS) in the database derives multi-tenancy from JWT claims and forbids client-sent tenancy fields.

- Headers to Supabase (server → Supabase):
  - `Authorization: Bearer <Clerk RS256 JWT (supabase template)>`
  - `apikey: <Supabase anon key>`
  - `content-type: application/json`

Required JWT claims consumed by RLS:

- `sub`: Clerk user id
- `org_id`: active organization id

## Data Model (Supabase)

Tables:

- `public.conversations`
  - Columns: `id (uuid)`, `org_id (text)`, `owner_user_id (text)`, `title (text)`, `model (text)`, `system_prompt (text)`, `archived_at (timestamptz)`, `created_at`, `updated_at`
  - `updated_at` is maintained via trigger and bumped when new messages arrive.
  - RLS policies restrict access to the active org and current user.

- `public.messages`
  - Columns: `id (uuid)`, `conversation_id (uuid)`, `org_id (text)`, `owner_user_id (text)`, `role (text)`, `content (jsonb)`, `text_content (generated)`, `idempotency_key (text)`, timestamps
  - Triggers copy `org_id`/`owner_user_id` from parent conversation and touch `conversations.updated_at` after insert.
  - Partial unique index supports idempotency: `(conversation_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.

Views:

- `public.conversation_summaries`
  - Includes `last_message_text` and is used by the sidebar.

RPCs:

- `public.rpc_append_message(p_conversation_id uuid, p_role text, p_content jsonb, p_idempotency_key text)`
  - Inserts a message; idempotent when `p_idempotency_key` is provided.

## API Routes (Next.js)

All chat routes are namespaced under `/api/chat/*`.

### GET /api/chat/conversations

Returns visible (non-archived) conversations for the current org/user, ordered by `updated_at desc`.

Response: `Array<{ id: string; title: string; updated_at: string; archived_at: string | null; last_message_text?: string }>`

### POST /api/chat/conversations

Creates a new conversation. Title is optional.

Body: `{ title?: string }`

Response: `{ id: string; title: string; ... }`

Notes:

- Tenancy fields are derived by RLS.

### PATCH /api/chat/conversations/:id

Updates a conversation’s title and/or archives it.

Body: `{ title?: string; archived?: boolean }`

Response: Updated conversation record.

### GET /api/chat/messages/:conversationId

Fetches messages for a conversation ordered by `created_at asc, id asc`. Response normalizes `content` to `{ text }`.

Response: `Array<{ id: string; role: 'user' | 'assistant' | 'system'; text: string }>`

### POST /api/chat/messages/:conversationId

Appends a message via the RPC.

Body:

```json
{ "role": "user", "text": "Hello", "idempotencyKey": "uuid-..." }
```

Response: Inserted message row.

Notes:

- Retries with the same `idempotencyKey` are safe; server retries once without the key on specific 400s.

## Client Flows

- Draft new chat: Clicking “New Chat” does not create a DB row. The first send creates a conversation with a UNIX timestamp title (placeholder), appends the message, then refreshes transcript and sidebar.
- Subsequent sends: call the RPC directly and refresh transcript; sidebar revalidates to reflect ordering.

## UI Notes

- Sidebar fetches `/api/chat/conversations` and sorts by `updated_at desc`. Active conversation is highlighted. Dropdown actions include Rename and Archive.
- Transcript uses AI elements (`Conversation`, `Message`, `Response`) and orders messages ascending by time.
- Composer uses AI elements (`PromptInput*`), supports Enter submit and Shift+Enter newline. Disabled while sending.

## Errors & Observability

- 401/403: surfaced with a Sonner toast ("Check you're signed in and in the correct workspace.").
- Logs: `conversation_created`, `message_sent`, `sidebar_refreshed` emitted client-side.

## Future TODOs

- Sidebar: “More” button (older conversations).
- Transcript: “Load older messages”.
- Titles: Generate AI title after assistant reply and update `conversations.title`.

import { auth } from "@clerk/nextjs/server"
import { getSupabaseEnv } from "@hubble/env"
import { createSupabaseRest } from "@hubble/db"
import { contentToText } from "@hubble/utils"

export const runtime = "nodejs"

export async function GET(_req: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  // TODO: Validate access to conversation by org/user
  //   Context: Ensure the conversation belongs to the authenticated org before returning messages.
  //   labels: area/web, feature/security, type/quality
  //   assignees: omzification
  //   milestone: 0.0.1
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { conversationId: convoId } = await ctx.params
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv()
  const sb = createSupabaseRest({ url: supabaseUrl, anonKey: supabaseAnonKey, token })
  const res = await sb.get(
    `/rest/v1/messages?select=id,role,content,created_at&conversation_id=eq.${encodeURIComponent(
      convoId,
    )}&order=created_at.asc,id.asc`,
  )
  if (!res.ok) return Response.json({ error: res.statusText }, { status: res.status })
  const rows = (await res.json()) as Array<{ id: string; role: string; content: unknown }>
  const msgs = rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant" | "system",
    text: contentToText(r.content),
  }))
  return Response.json(msgs)
}

export async function POST(req: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  // TODO: Add pagination via cursor query params
  //   Context: Support `?cursor=<id>&limit=50` for incremental fetch and lazy-loading older messages.
  //   labels: area/web, feature/chat, type/enhancement
  //   assignees: omzification
  //   milestone: 0.0.1
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { conversationId: convoId } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as {
    role?: "user" | "assistant" | "system"
    text?: string
    idempotencyKey?: string
  }
  const role = body.role ?? "user"
  const text = body.text ?? ""
  const idem = body.idempotencyKey ?? null
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv()
  const sb = createSupabaseRest({ url: supabaseUrl, anonKey: supabaseAnonKey, token })
  const res = await sb.post(`/rest/v1/rpc/rpc_append_message`, {
    p_conversation_id: convoId,
    p_role: role,
    p_content: { text },
    p_idempotency_key: idem,
  })
  if (!res.ok) {
    if (res.status === 400 && idem) {
      const res2 = await sb.post(`/rest/v1/rpc/rpc_append_message`, {
        p_conversation_id: convoId,
        p_role: role,
        p_content: { text },
        p_idempotency_key: null,
      })
      if (res2.ok) {
        const row = await res2.json()
        return Response.json(row)
      }
    }
    const textMsg = await res.text().catch(() => res.statusText)
    return Response.json({ error: textMsg }, { status: res.status })
  }
  const row = await res.json()
  return Response.json(row)
}

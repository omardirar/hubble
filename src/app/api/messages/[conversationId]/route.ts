import { auth } from "@clerk/nextjs/server"

export const runtime = "nodejs"

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

function supabaseHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    apikey: supabaseAnonKey,
    "content-type": "application/json",
    Prefer: "return=representation",
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { conversationId: convoId } = await ctx.params
  const url = `${supabaseUrl}/rest/v1/messages?select=id,role,content,created_at&conversation_id=eq.${encodeURIComponent(convoId)}&order=created_at.asc,id.asc`
  const res = await fetch(url, { headers: supabaseHeaders(token) })
  if (!res.ok) return Response.json({ error: res.statusText }, { status: res.status })
  const rows = (await res.json()) as Array<{ id: string; role: string; content: unknown }>
  const msgs = rows.map((r) => {
    let text = ""
    if (typeof r.content === "string") {
      text = r.content
    } else if (r.content !== null && typeof r.content === "object") {
      const contentObj = r.content as Record<string, unknown>
      if ("text" in contentObj) {
        const value = (contentObj as { text?: unknown }).text
        text = value != null ? String(value) : ""
      }
    }
    return { id: r.id, role: r.role as "user" | "assistant" | "system", text }
  })
  return Response.json(msgs)
}

export async function POST(req: Request, ctx: { params: Promise<{ conversationId: string }> }) {
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
  const url = `${supabaseUrl}/rest/v1/rpc/rpc_append_message`
  const res = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders(token),
    body: JSON.stringify({
      p_conversation_id: convoId,
      p_role: role,
      p_content: { text },
      p_idempotency_key: idem,
    }),
  })
  if (!res.ok) {
    // Fallback: retry without idempotency key to avoid constraint shape issues
    if (res.status === 400 && idem) {
      const res2 = await fetch(url, {
        method: "POST",
        headers: supabaseHeaders(token),
        body: JSON.stringify({
          p_conversation_id: convoId,
          p_role: role,
          p_content: { text },
          p_idempotency_key: null,
        }),
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

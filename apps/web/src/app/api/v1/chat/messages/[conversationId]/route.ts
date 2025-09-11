import { auth } from "@clerk/nextjs/server"
import { createBrowserClient } from "@hubble/db"
import { contentToText } from "@hubble/utils"

export const runtime = "nodejs"

export async function GET(_req: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  // RLS enforcement: Using createBrowserClient with authToken ensures user can only access their org's messages
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { conversationId: convoId } = await ctx.params
  const supabase = createBrowserClient({ authToken: token })
  const { data, error } = await supabase
    .from("messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", convoId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const msgs = (data || []).map((r) => ({
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

  const supabase = createBrowserClient({ authToken: token })
  const { data, error } = await supabase.rpc("rpc_append_message", {
    p_conversation_id: convoId,
    p_role: role,
    p_content: { text },
    p_idempotency_key: idem,
  })

  if (error) {
    // Handle idempotency conflict by fetching the existing message
    // Check for unique constraint violation (23505) or idempotency-related error message
    if ((error.code === "23505" || error.message?.includes("idempotency")) && idem) {
      // Fetch the existing message that was created with this idempotency key
      const { data: existingMessage, error: fetchError } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", convoId)
        .eq("idempotency_key", idem)
        .single()

      if (fetchError) {
        return Response.json(
          { error: `Failed to fetch existing message: ${fetchError.message}` },
          { status: 500 },
        )
      }

      // Return the existing message in the same format as a new message
      return Response.json({
        id: existingMessage.id,
        role: existingMessage.role,
        content: existingMessage.content,
        created_at: existingMessage.created_at,
      })
    }

    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

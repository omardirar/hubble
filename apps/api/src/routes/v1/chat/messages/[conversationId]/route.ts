import { createBrowserClientFromSecrets } from "@hubble/db"
import { type SecretsStoreEnv } from "@hubble/env"
import { contentToText } from "@hubble/utils"

export async function handleMessages(
  request: Request,
  env: SecretsStoreEnv,
  params: { conversationId: string },
): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = await createBrowserClientFromSecrets(env, { authToken: token })

    if (request.method === "GET") {
      const { data, error } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", params.conversationId)
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

    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        role?: "user" | "assistant" | "system"
        text?: string
        idempotencyKey?: string
      }
      const role = body.role ?? "user"
      const text = body.text ?? ""
      const idem = body.idempotencyKey ?? null

      const { data, error } = await supabase.rpc("rpc_append_message", {
        p_conversation_id: params.conversationId,
        p_role: role,
        p_content: { text },
        p_idempotency_key: idem,
      })

      if (error) {
        // Handle idempotency conflict by fetching the existing message
        if ((error.code === "23505" || error.message?.includes("idempotency")) && idem) {
          const { data: existingMessage, error: fetchError } = await supabase
            .from("messages")
            .select("id,role,content,created_at")
            .eq("conversation_id", params.conversationId)
            .eq("idempotency_key", idem)
            .single()

          if (fetchError) {
            return Response.json(
              { error: `Failed to fetch existing message: ${fetchError.message}` },
              { status: 500 },
            )
          }

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

    return Response.json({ error: "Method not allowed" }, { status: 405 })
  } catch (error) {
    console.error("Messages endpoint error:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

import { createBrowserClientWithFallback } from "@hubble/db"
import { type SecretsStoreEnv } from "@hubble/env"
import { extractJWTClaims } from "@hubble/auth"
import { contentToText } from "@hubble/utils"
import {
  type ApiMessage,
  type CreateMessageRequest,
  type CreateMessageResponse,
  validateCreateMessageRequest,
  validateApiMessage,
} from "@hubble/api-contracts/chat"

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

    // Extract user and organization information from JWT token
    const { userId, orgId } = extractJWTClaims(token)

    const supabase = await createBrowserClientWithFallback(env, { authToken: token })

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

      const msgs: ApiMessage[] = (data || []).map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant" | "system",
        text: contentToText(r.content),
        created_at: r.created_at,
      }))

      // Validate response data against schema
      const validatedData = msgs.map(validateApiMessage)
      return Response.json(validatedData)
    }

    if (request.method === "POST") {
      // Validate request body against schema
      const body = await request.json().catch(() => ({}))
      const validatedBody = validateCreateMessageRequest(body)
      const role = validatedBody.role ?? "user"
      const text = validatedBody.text ?? ""
      const idem = validatedBody.idempotencyKey ?? null

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

      // Validate response data against schema
      const validatedData: CreateMessageResponse = data
      return Response.json(validatedData)
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

import { createBrowserClientFromSecrets } from "@hubble/db"
import { type SecretsStoreEnv } from "@hubble/env"

export async function handleConversations(
  request: Request,
  env: SecretsStoreEnv,
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
        .from("conversation_summaries")
        .select("id,title,updated_at,archived_at,last_message_text")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      return Response.json(data)
    }

    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { title?: string }
      const title = body.title ?? "New Chat"

      // Extract user info from JWT token (simplified - in production, verify the token)
      // For now, we'll use placeholder values - in production, decode the JWT
      const userId = "placeholder_user_id" // TODO: Extract from JWT
      const orgId = "placeholder_org_id" // TODO: Extract from JWT

      const { data, error } = await supabase
        .from("conversations")
        .insert({
          title,
          owner_user_id: userId,
          org_id: orgId,
        })
        .select()
        .single()

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      return Response.json(data)
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 })
  } catch (error) {
    console.error("Conversations endpoint error:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

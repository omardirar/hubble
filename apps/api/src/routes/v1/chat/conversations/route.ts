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

      // Let RLS/DB defaults derive tenancy from the JWT; do not inject placeholders
      const { data, error } = await supabase
        .from("conversations")
        .insert({ title })
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

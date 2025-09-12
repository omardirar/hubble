import { createBrowserClientFromSecrets } from "@hubble/db"
import { type SecretsStoreEnv } from "@hubble/env"

export async function handleConversationById(
  request: Request,
  env: SecretsStoreEnv,
  params: { id: string },
): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = await createBrowserClientFromSecrets(env, { authToken: token })

    if (request.method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as {
        title?: string
        archived?: boolean
      }
      const updates: Record<string, unknown> = {}
      if (typeof body.title === "string") updates.title = body.title
      if (typeof body.archived === "boolean")
        updates.archived_at = body.archived ? new Date().toISOString() : null

      const { data, error } = await supabase
        .from("conversations")
        .update(updates)
        .eq("id", params.id)
        .select()
        .single()

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      return Response.json(data)
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 })
  } catch (error) {
    console.error("Conversation by ID endpoint error:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

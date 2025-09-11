import { auth } from "@clerk/nextjs/server"
import { createBrowserClient } from "@hubble/db"

export const runtime = "nodejs"

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // RLS enforcement: Using createBrowserClient with authToken ensures user can only access their org's conversations
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { title?: string; archived?: boolean }
  const updates: Record<string, unknown> = {}
  if (typeof body.title === "string") updates.title = body.title
  if (typeof body.archived === "boolean")
    updates.archived_at = body.archived ? new Date().toISOString() : null

  const supabase = createBrowserClient({ authToken: token })
  const { data, error } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

import { auth } from "@clerk/nextjs/server"
import { createBrowserClient } from "@hubble/db"

export const runtime = "nodejs"

export async function GET() {
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createBrowserClient({ authToken: token })
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

export async function POST(req: Request) {
  const { getToken, userId, orgId } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!userId || !orgId) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { title?: string }
  const title = body.title ?? "New Chat"

  const supabase = createBrowserClient({ authToken: token })
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

import { auth } from "@clerk/nextjs/server"
import { getSupabaseEnv } from "@hubble/env"
import { createSupabaseRest } from "@hubble/db"

export const runtime = "nodejs"

export async function GET() {
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv()
  const sb = createSupabaseRest({ url: supabaseUrl, anonKey: supabaseAnonKey, token })
  const res = await sb.get(
    `/rest/v1/conversation_summaries?select=id,title,updated_at,archived_at,last_message_text&archived_at=is.null&order=updated_at.desc`,
  )
  if (res.status === 401 || res.status === 403) {
    return Response.json({ error: "Forbidden" }, { status: res.status })
  }
  const data = await res.json()
  return Response.json(data)
}

export async function POST(req: Request) {
  const { getToken, userId, orgId } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!userId || !orgId) return Response.json({ error: "Forbidden" }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as { title?: string }
  const title = body.title ?? "New Chat"
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv()
  const sb = createSupabaseRest({ url: supabaseUrl, anonKey: supabaseAnonKey, token })
  const res = await sb.post(`/rest/v1/conversations`, {
    title,
    owner_user_id: userId,
    org_id: orgId,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return Response.json({ error: text }, { status: res.status })
  }
  const data = await res.json()
  return Response.json(Array.isArray(data) ? data[0] : data)
}

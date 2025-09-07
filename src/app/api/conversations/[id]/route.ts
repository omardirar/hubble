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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const id = params.id
  const body = (await req.json().catch(() => ({}))) as { title?: string; archived?: boolean }
  const updates: Record<string, unknown> = {}
  if (typeof body.title === "string") updates.title = body.title
  if (typeof body.archived === "boolean")
    updates.archived_at = body.archived ? new Date().toISOString() : null

  const url = `${supabaseUrl}/rest/v1/conversations?id=eq.${encodeURIComponent(id)}`
  const res = await fetch(url, {
    method: "PATCH",
    headers: supabaseHeaders(token),
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return Response.json({ error: text }, { status: res.status })
  }
  const data = await res.json()
  return Response.json(Array.isArray(data) ? data[0] : data)
}

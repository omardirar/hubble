import { auth } from "@clerk/nextjs/server"

export const runtime = "nodejs"

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // RLS enforcement: Using createBrowserClient with authToken ensures user can only access their org's conversations
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  // Proxy request to API worker
  const apiUrl = process.env.API_BASE_URL || "https://hubble-api-preview.github-cc7.workers.dev"
  const response = await fetch(`${apiUrl}/v1/chat/conversations/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
    return Response.json(errorData, { status: response.status })
  }

  const data = await response.json()
  return Response.json(data)
}

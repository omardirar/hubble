import { auth } from "@clerk/nextjs/server"
import { getApiWorkerUrl } from "@hubble/utils"

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // RLS enforcement occurs in the API Worker (via Supabase JWT). We only pass the JWT.
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  // Proxy request to API worker
  const apiUrl = getApiWorkerUrl()
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

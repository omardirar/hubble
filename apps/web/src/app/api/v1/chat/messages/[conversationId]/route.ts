import { auth } from "@clerk/nextjs/server"
import { getApiWorkerUrl } from "@hubble/utils"

export async function GET(_req: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { conversationId: convoId } = await ctx.params

  // Proxy request to API worker
  const apiUrl = getApiWorkerUrl()
  const response = await fetch(`${apiUrl}/v1/chat/messages/${convoId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
    return Response.json(errorData, { status: response.status })
  }

  const data = await response.json()
  return Response.json(data)
}

export async function POST(req: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  // TODO: Add pagination via cursor query params
  //   Context: Support `?cursor=<id>&limit=50` for incremental fetch and lazy-loading older messages.
  //   labels: area/web, feature/chat, type/enhancement
  //   assignees: omzification
  //   milestone: 0.0.1
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { conversationId: convoId } = await ctx.params
  const body = await req.json().catch(() => ({}))

  // Proxy request to API worker
  const apiUrl = getApiWorkerUrl()
  const response = await fetch(`${apiUrl}/v1/chat/messages/${convoId}`, {
    method: "POST",
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

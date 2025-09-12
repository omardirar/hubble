import { auth } from "@clerk/nextjs/server"

export const runtime = "nodejs"

export async function GET() {
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // Proxy request to API worker
  const apiUrl = process.env.API_BASE_URL || "https://hubble-api-preview.github-cc7.workers.dev"
  const response = await fetch(`${apiUrl}/v1/chat/conversations`, {
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

export async function POST(req: Request) {
  const { getToken, userId, orgId } = await auth()
  const token = await getToken({ template: "supabase" }).catch(() => null)
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!userId || !orgId) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))

  // Proxy request to API worker
  const apiUrl = process.env.API_BASE_URL || "https://hubble-api-preview.github-cc7.workers.dev"
  const response = await fetch(`${apiUrl}/v1/chat/conversations`, {
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

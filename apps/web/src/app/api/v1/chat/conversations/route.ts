import { auth } from "@clerk/nextjs/server"
import { getApiWorkerUrl } from "@hubble/utils"

export async function GET() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // Proxy request to API worker
  const apiUrl = getApiWorkerUrl()
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
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Proxy request to API worker
  const apiUrl = getApiWorkerUrl()
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

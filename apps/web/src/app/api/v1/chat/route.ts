import { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Proxy request to API worker
    const apiUrl = process.env.API_BASE_URL || "https://hubble-api-preview.github-cc7.workers.dev"
    const response = await fetch(`${apiUrl}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.get("Authorization") || "",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      return Response.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: "Unexpected error", detail: msg }, { status: 500 })
  }
}

import { NextRequest } from "next/server"
import { getAnthropicEnv } from "@hubble/env"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json().catch(() => ({}))) as { text?: string }
    const prompt = (text ?? "").trim()
    if (!prompt) {
      return Response.json({ error: "Missing text" }, { status: 400 })
    }

    const { apiKey, model } = getAnthropicEnv()

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!upstream.ok) {
      const msg = await upstream.text().catch(() => upstream.statusText)
      return Response.json({ error: "Upstream error", detail: msg }, { status: 502 })
    }

    const data = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const reply = Array.isArray(data.content)
      ? (data.content.find((c) => c.type === "text")?.text ?? "")
      : ""

    return Response.json({ reply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Missing ANTHROPIC_API_KEY")) {
      return Response.json({ error: "Upstream not configured" }, { status: 502 })
    }
    return Response.json({ error: "Unexpected error", detail: msg }, { status: 500 })
  }
}

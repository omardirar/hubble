import { NextRequest } from "next/server"
import { streamText, convertToCoreMessages, stepCountIs } from "ai"
import type { UIMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { auth } from "@clerk/nextjs/server"
import { resolveDbForOrg } from "@/lib/tenant"
import { signDbJwtRS256 } from "@/lib/jwt"
import { config } from "@/lib/config"
import { connectMcp } from "@/lib/mcp"
import { randomUUID } from "crypto"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const startMs = Date.now()
  const traceId = randomUUID()

  const rawBody: unknown = await req.json().catch(() => ({}))
  let messages: UIMessage[] = []
  let clientHint: string | undefined
  if (rawBody && typeof rawBody === "object") {
    const rb = rawBody as Record<string, unknown>
    if (Array.isArray(rb.messages)) messages = rb.messages as UIMessage[]
    if (typeof rb.db === "string") clientHint = rb.db
  }

  const { userId, orgId } = await auth()
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!orgId) {
    return Response.json({ error: "Organization required" }, { status: 403 })
  }

  let dbName: string
  try {
    dbName = await resolveDbForOrg(orgId, clientHint)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(
      JSON.stringify({ traceId, userId, orgId, event: "db_resolve_error", msg })
    )
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const mcpUrl = config.mcpMotherduckUrl

  try {
    const jwt = await signDbJwtRS256({ sub: userId, db: dbName })

    // Derive Origin for servers that enforce origin checks
    const hdrs = req.headers
    const xfProto = hdrs.get("x-forwarded-proto") || "https"
    const xfHost = hdrs.get("x-forwarded-host") || hdrs.get("host") || ""
    const originHeader = hdrs.get("origin") || (xfHost ? `${xfProto}://${xfHost}` : undefined)

    const { tools } = await connectMcp({
      mcpUrl,
      jwt,
      dbName,
      origin: originHeader,
    })

    const result = streamText({
      model: anthropic(config.anthropicModel),
      messages: convertToCoreMessages(messages),
      system:
        "You are a helpful assistant with read-only access to a MotherDuck database. Use only SELECT queries, apply tight LIMITs, and avoid full scans. Explain your steps briefly.",
      stopWhen: stepCountIs(10),
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
      },
      tools,
    })

    console.info(
      JSON.stringify({
        traceId,
        userId,
        orgId,
        db: dbName,
        event: "chat_stream_started",
        latencyMs: Date.now() - startMs,
      })
    )

    return result.toUIMessageStreamResponse()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(
      JSON.stringify({
        traceId,
        userId,
        orgId,
        db: dbName,
        event: "upstream_error",
        type: err instanceof Error ? err.name : "UnknownError",
        msg: errMsg,
      })
    )

    const result = streamText({
      model: anthropic(config.anthropicModel),
      messages: [
        {
          role: "user",
          content:
            "Please provide a brief, user-friendly error message explaining that the data tools are temporarily unavailable. Do not include technical details. Keep it under 2 sentences.",
        },
      ],
      system:
        "Output a short, safe error apology indicating the data tools are temporarily unavailable. Do not reveal internal details. Keep under 2 sentences.",
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
      },
    })

    return result.toUIMessageStreamResponse({ status: 502 })
  }
}



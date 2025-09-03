import { NextRequest } from "next/server"
import { streamText, convertToCoreMessages, stepCountIs } from "ai"
import { dynamicTool, jsonSchema } from "@ai-sdk/provider-utils"
import type { UIMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { auth } from "@clerk/nextjs/server"
import { resolveDbForOrg } from "@/lib/tenant"
import { signDbJwtRS256 } from "@/lib/jwt"
import { randomUUID } from "crypto"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { z } from "zod"

type Closeable = { close?: () => Promise<void> }
function hasClose(value: unknown): value is { close: () => Promise<void> } {
  return typeof (value as { close?: unknown })?.close === "function"
}
async function tryClose(value: unknown) {
  if (hasClose(value)) {
    await value.close()
  }
}

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const startMs = Date.now()
  const traceId = randomUUID()

  const isDebug = process.env.LOG_LEVEL === "debug"
  const modelName = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"

  // TODO: Add per-user rate limiting (e.g., Upstash Redis); return 429 when exceeded
  //  labels: area:api, security, P1
  //  assignees: me
  //  milestone: M0 - Safety Net
  //  evidence: src/app/api/chat/route.ts:16-25 — no rate limiter present

  // Validate request body
  const bodySchema = z
    .object({
      messages: z.array(z.any()).max(50).default([]),
      db: z.string().max(128).regex(/^[\w-]+$/).optional(),
    })

  // TODO: Tighten message schema to validated UIMessage shape; cap total tokens
  //  labels: area:api, testing, P2
  //  assignees: me
  //  milestone: M1 - Baseline Tests
  //  evidence: src/app/api/chat/route.ts:28-33 — schema accepts any[]

  let messages: UIMessage[] = []
  let clientHint: string | undefined
  try {
    const rawBody: unknown = await req.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(rawBody)
    if (parsed.success) {
      messages = (parsed.data.messages as unknown[]) as UIMessage[]
      clientHint = parsed.data.db
    }
  } catch {
    messages = []
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

  const mcpUrl = process.env.MCP_MOTHERDUCK_URL
  if (!mcpUrl) {
    console.error(JSON.stringify({ traceId, userId, orgId, db: dbName, event: "missing_mcp_url" }))
    return Response.json({ error: "Bad Gateway" }, { status: 502 })
  }

  let mcpClient: Client | undefined
  let transport: StreamableHTTPClientTransport | undefined
  try {
    const jwt = await signDbJwtRS256({ sub: userId, db: dbName })

    // Use allowlisted origin if provided (avoid trusting forwarded headers)
    const allowedOrigin = process.env.ALLOWED_ORIGIN
    const originHeader = allowedOrigin ?? undefined

    mcpClient = new Client(
      { name: "hubble-chat", version: "1.0.0" },
      { capabilities: {} as import("@modelcontextprotocol/sdk/types.js").ClientCapabilities }
    )
    transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "X-Db-Name": dbName,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(originHeader ? { Origin: originHeader } : {}),
        },
      },
    })
    await mcpClient.connect(transport)
    try {
      // TODO: Cache MCP tool list per request/server instance to reduce latency
      //  labels: perf, area:api, P3
      //  assignees: me
      //  milestone: M3 - Perf & DX
      //  evidence: src/app/api/chat/route.ts:88 — listTools called every request
      const list = await mcpClient.listTools()
      const tools = Object.fromEntries(
        (list.tools ?? []).map((t) => {
          const tName = t.name
          const tDesc = t.description || ""
          const tTool = dynamicTool({
            description: tDesc,
            inputSchema: jsonSchema(
              (t as { inputSchema?: unknown })?.inputSchema ?? { type: "object", properties: {}, required: [] }
            ),
            execute: async (args: unknown) => {
              const safeArgs: Record<string, unknown> = args && typeof args === "object" ? (args as Record<string, unknown>) : {}
              const result = await mcpClient!.callTool({ name: tName, arguments: safeArgs })
              const texts: string[] = []
              const contentArray = (result as { content?: unknown })?.content
              if (Array.isArray(contentArray)) {
                for (const c of contentArray as Array<unknown>) {
                  if (
                    c &&
                    typeof c === "object" &&
                    "type" in c &&
                    (c as { type?: unknown }).type === "text" &&
                    "text" in c &&
                    typeof (c as { text?: unknown }).text === "string"
                  ) {
                    texts.push((c as { text: string }).text)
                  }
                }
              }
              return texts.length > 0 ? texts.join("\n\n") : result
            },
          })
          return [tName, tTool]
        })
      )

      // TODO: Extract ChatService to separate file for unit testing stream orchestration
      //  labels: tech-debt, testing, area:api, P1
      //  assignees: me
      //  milestone: M2 - Refactors
      //  evidence: src/app/api/chat/route.ts:101-122 — monolithic handler
      const result = streamText({
        model: anthropic(modelName),
        messages: convertToCoreMessages(messages),
        system:
          "You are a helpful assistant with read-only access to a MotherDuck database. Use only SELECT queries, apply tight LIMITs, and avoid full scans. Explain your steps briefly.",
        stopWhen: stepCountIs(10),
        experimental_telemetry: {
          isEnabled: isDebug,
          recordInputs: isDebug,
          recordOutputs: isDebug,
        },
        tools,
      })

      const baseLog = { traceId, event: "chat_stream_started", latencyMs: Date.now() - startMs }
      console.info(JSON.stringify(isDebug ? { ...baseLog, db: dbName, orgId, userId } : baseLog))

      return result.toUIMessageStreamResponse()
    } finally {
      try { await tryClose(mcpClient) } catch {}
      try { await tryClose(transport) } catch {}
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const baseErr = {
      traceId,
      event: "upstream_error",
      type: err instanceof Error ? err.name : "UnknownError",
      msg: errMsg,
    }
    console.error(JSON.stringify(isDebug ? { ...baseErr, db: dbName, orgId, userId } : baseErr))

    const result = streamText({
      model: anthropic(modelName),
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
        isEnabled: isDebug,
        recordInputs: false,
        recordOutputs: false,
      },
    })

    return result.toUIMessageStreamResponse({ status: 502 })
  }
}



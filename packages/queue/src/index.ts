import { getQStashConfig } from "@hubble/env"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"

export class QStashError extends Error {
  declare cause?: unknown

  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = "QStashError"
    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

export class QStashPublishError extends QStashError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "QStashPublishError"
  }
}

export interface PublishOptions<TBody = unknown> {
  targetUrl: string
  body: TBody
  dedupeKey?: string
  method?: "POST" | "GET" | "PUT" | "DELETE" | "PATCH"
  headers?: Record<string, string>
}

export interface PublishResult {
  bypassed: boolean
  jobId?: string
  response?: unknown
}

function getPublishEndpoint(targetUrl: string) {
  // Use the correct QStash API format with target URL in the path
  return `https://qstash.upstash.io/v2/publish/${targetUrl}`
}

export async function publishJson<TBody = unknown>(
  options: PublishOptions<TBody>,
): Promise<PublishResult> {
  const { targetUrl, body, dedupeKey, method = "POST", headers } = options
  const { token } = getQStashConfig()
  const endpoint = getPublishEndpoint(targetUrl)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Method": method,
        ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? {
              "Upstash-Forward-x-vercel-protection-bypass":
                process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
            }
          : {}),
        ...(dedupeKey ? { "Upstash-Deduplication-Id": dedupeKey } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      let errorDetails = ""
      try {
        const errorBody = await res.text()
        errorDetails = ` - ${errorBody}`
      } catch {
        // Ignore if we can't parse the error body
      }
      throw new QStashPublishError(`QStash publish failed with status ${res.status}${errorDetails}`)
    }

    const payload = await res.json().catch(() => ({}))
    const jobId =
      typeof payload === "object" && payload && "messageId" in payload
        ? String((payload as Record<string, unknown>).messageId)
        : undefined

    return {
      bypassed: false,
      jobId,
      response: payload,
    }
  } catch (error) {
    if (error instanceof QStashError) {
      throw error
    }

    // Handle timeout errors specifically
    if (error instanceof Error && error.name === "AbortError") {
      throw new QStashPublishError("QStash request timed out after 30 seconds", { cause: error })
    }

    throw new QStashPublishError("Failed to publish to QStash", { cause: error })
  }
}

export async function dispatchJson<TBody>(options: PublishOptions<TBody>): Promise<PublishResult> {
  return publishJson(options)
}

export function withQStashVerification<
  THanlder extends (request: Request) => Promise<Response> | Response,
>(handler: THanlder, options?: { skipVerification?: boolean }): THanlder {
  if (options?.skipVerification) {
    return handler
  }

  const { currentSigningKey, nextSigningKey } = getQStashConfig()
  return verifySignatureAppRouter(handler, {
    currentSigningKey,
    nextSigningKey,
  }) as THanlder
}

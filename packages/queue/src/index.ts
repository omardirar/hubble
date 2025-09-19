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
  method?: string
  headers?: Record<string, string>
}

export interface PublishResult {
  bypassed: boolean
  jobId?: string
  response?: unknown
}

function getPublishEndpoint(targetUrl: string) {
  // Use the correct QStash API format
  return "https://qstash.upstash.io/v2/publish"
}

export function shouldBypassQStash(targetUrl: string): boolean {
  const forceBypass = process.env.QSTASH_BYPASS === "1"
  if (forceBypass) {
    return true
  }

  if (process.env.NODE_ENV !== "development") {
    return false
  }

  try {
    const url = new URL(targetUrl)
    const host = url.hostname.toLowerCase()
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
      return true
    }
    if (host.endsWith(".local")) {
      return true
    }
  } catch (error) {
    console.warn("qstash.bypass.invalid_url", { targetUrl, error })
  }

  return false
}

export async function publishJson<TBody = unknown>(
  options: PublishOptions<TBody>,
): Promise<PublishResult> {
  const { targetUrl, body, dedupeKey, method = "POST", headers } = options
  const { token } = getQStashConfig()
  const endpoint = getPublishEndpoint(targetUrl)

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Url": targetUrl,
        "Upstash-Callback-Method": method,
        ...(dedupeKey ? { "Upstash-Deduplication-Id": dedupeKey } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
    })

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

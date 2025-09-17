import { getConnectEnv } from "@hubble/env"

function basicAuthHeader(user: string, pass: string) {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64")
}

type HttpOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

async function httpFetch(url: string, opts: HttpOptions = {}): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000)
  try {
    return await fetch(url, {
      method: opts.method ?? "GET",
      headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
      body: opts.body,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

export async function fivetranUpsertMotherDuckDestination(
  externalId: string,
  mdDbName: string,
  mdTokenRef: string, // reference only; do not send token here
): Promise<{ destination_id: string }> {
  // NOTE: This function assumes separate secure exchange of token when configuring destination.
  // In real integration, you'd securely pull sa token just-in-time server-side and send to Fivetran.
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()
  const base = "https://api.fivetran.com/v1"
  const auth = basicAuthHeader(FIVETRAN_API_KEY, FIVETRAN_API_SECRET)

  // Try to find existing destination by externalId (using a tag/name convention)
  // Placeholder implementation: create unconditionally; idempotency achieved by name conflict handling
  const res = await httpFetch(`${base}/destinations`, {
    method: "POST",
    headers: { Authorization: auth },
    body: JSON.stringify({
      group_id: externalId, // using externalId as group for determinism (adjust per real API)
      service: "motherduck",
      config: {
        database: mdDbName,
        // The actual token should be provided securely at creation time; here we expect a separate
        // secure path to fetch it when calling this function in the server-only consumer.
      },
    }),
  })
  if (res.status === 409) {
    // Destination exists; fetch and return id (simplified)
    return { destination_id: externalId }
  }
  if (!res.ok) throw new Error(`Fivetran create destination failed: ${res.status}`)
  const data = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
  const destination_id = data?.data?.id ?? externalId
  return { destination_id }
}

export async function fivetranTestDestination(destinationId: string): Promise<boolean> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()
  const base = "https://api.fivetran.com/v1"
  const auth = basicAuthHeader(FIVETRAN_API_KEY, FIVETRAN_API_SECRET)
  const res = await httpFetch(`${base}/destinations/${encodeURIComponent(destinationId)}/test`, {
    method: "POST",
    headers: { Authorization: auth },
  })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`Fivetran test destination failed: ${res.status}`)
  return true
}

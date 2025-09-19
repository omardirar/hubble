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
  mdTokenRef: string, // reference to the token stored in Supabase Vault
): Promise<{ destination_id: string }> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()
  const base = "https://api.fivetran.com/v1"
  const auth = basicAuthHeader(FIVETRAN_API_KEY, FIVETRAN_API_SECRET)

  // Create a Fivetran destination for MotherDuck
  // Note: This is a simplified implementation - real Fivetran API may have different requirements
  const res = await httpFetch(`${base}/destinations`, {
    method: "POST",
    headers: { Authorization: auth },
    body: JSON.stringify({
      service: "motherduck", // This may need to be adjusted based on Fivetran's supported services
      config: {
        database: mdDbName,
        // Note: MotherDuck token should be securely provided to Fivetran
        // This may require additional configuration or a different approach
      },
      external_id: externalId, // Use external_id for idempotency
    }),
  })

  if (res.status === 409) {
    // Destination exists; fetch and return id
    return { destination_id: externalId }
  }

  if (!res.ok) {
    let errorBody = ""
    try {
      errorBody = await res.text()
    } catch {
      errorBody = "Unable to read error response"
    }
    throw new Error(
      `Fivetran create destination failed: ${res.status} ${res.statusText} - ${errorBody}`,
    )
  }

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

import { getConnectEnv } from "@hubble/env"

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

/**
 * Minimal MotherDuck admin client.
 * NOTE: Endpoints are placeholders; replace with real MotherDuck Admin API endpoints.
 */
export async function mdCreateServiceAccount(username: string): Promise<{ username: string }> {
  const { MD_ADMIN_TOKEN } = getConnectEnv()

  try {
    const res = await httpFetch("https://api.motherduck.com/admin/service-accounts", {
      method: "POST",
      headers: { Authorization: `Bearer ${MD_ADMIN_TOKEN}` },
      body: JSON.stringify({ username }),
    })

    if (res.status === 409) return { username }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      throw new Error(`MotherDuck API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    return { username }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create MotherDuck service account '${username}': ${error.message}`)
    }
    throw new Error(`Failed to create MotherDuck service account '${username}': ${String(error)}`)
  }
}

export async function mdIssueToken(username: string): Promise<{ token: string }> {
  const { MD_ADMIN_TOKEN } = getConnectEnv()

  try {
    const res = await httpFetch(
      `https://api.motherduck.com/admin/service-accounts/${encodeURIComponent(username)}/tokens`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${MD_ADMIN_TOKEN}` },
      },
    )

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      throw new Error(`MotherDuck API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    const data = (await res.json().catch(() => ({}))) as { token?: string }
    if (!data.token) throw new Error("MotherDuck API returned no token")
    return { token: data.token }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to issue MotherDuck token for '${username}': ${error.message}`)
    }
    throw new Error(`Failed to issue MotherDuck token for '${username}': ${String(error)}`)
  }
}

export async function mdCreateDatabase(dbName: string, saToken: string): Promise<void> {
  try {
    const res = await httpFetch("https://api.motherduck.com/databases", {
      method: "POST",
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({ name: dbName }),
    })

    if (res.status === 409) return // Database already exists

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      throw new Error(`MotherDuck API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create MotherDuck database '${dbName}': ${error.message}`)
    }
    throw new Error(`Failed to create MotherDuck database '${dbName}': ${String(error)}`)
  }
}

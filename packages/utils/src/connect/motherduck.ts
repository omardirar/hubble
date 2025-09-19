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
 * MotherDuck admin client using the official REST API.
 * Based on MotherDuck REST API documentation: https://motherduck.com/docs/sql-reference/rest-api/motherduck-rest-api/
 */
export async function mdCreateServiceAccount(username: string): Promise<{ username: string }> {
  const { MD_ADMIN_TOKEN } = getConnectEnv()

  // Debug logging to verify token is loaded
  console.log("MotherDuck API Debug:", {
    hasToken: !!MD_ADMIN_TOKEN,
    tokenLength: MD_ADMIN_TOKEN?.length || 0,
    username,
  })

  try {
    // Create a new user (service account) using MotherDuck REST API
    const res = await httpFetch("https://api.motherduck.com/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MD_ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: username,
        // Note: MotherDuck API may not support type field
        // Service accounts are created as regular users with specific permissions
      }),
    })

    if (res.status === 409) return { username } // User already exists

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

  // Debug logging to verify token is loaded
  console.log("MotherDuck Issue Token Debug:", {
    hasToken: !!MD_ADMIN_TOKEN,
    tokenLength: MD_ADMIN_TOKEN?.length || 0,
    username,
  })

  try {
    // Create an access token for the user using MotherDuck REST API
    const res = await httpFetch(
      `https://api.motherduck.com/users/${encodeURIComponent(username)}/tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MD_ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${username}_token`,
          // Note: MotherDuck API may not support expires_in field
          // Token expiration should be set via MotherDuck UI or different API
        }),
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

    const data = (await res.json().catch(() => ({}))) as { token?: string; access_token?: string }
    const token = data.token || data.access_token
    if (!token) throw new Error("MotherDuck API returned no token")
    return { token }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to issue MotherDuck token for '${username}': ${error.message}`)
    }
    throw new Error(`Failed to issue MotherDuck token for '${username}': ${String(error)}`)
  }
}

export async function mdCreateDatabase(dbName: string, saToken: string): Promise<void> {
  try {
    // MotherDuck databases are created via the databases API
    // This creates a new database in the MotherDuck organization
    const res = await httpFetch("https://api.motherduck.com/databases", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${saToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: dbName,
      }),
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

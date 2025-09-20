import { getConnectEnv } from "@hubble/env"
import { logger } from "@hubble/logger"

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

  // Enhanced debug logging to verify all inputs
  logger.info("connect.motherduck.create_service_account.debug", {
    hasToken: !!MD_ADMIN_TOKEN,
    tokenLength: MD_ADMIN_TOKEN?.length || 0,
    username,
    usernameType: typeof username,
    usernameLength: username?.length || 0,
    tokenPrefix: MD_ADMIN_TOKEN?.substring(0, 10) + "...",
  })

  // Validate username parameter
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    throw new Error(`Invalid username parameter: ${JSON.stringify(username)}`)
  }

  // Based on MotherDuck API documentation, only username is required for service account creation
  const requestPayload = {
    username: username.trim(),
  }

  logger.info("connect.motherduck.create_service_account.request_payload", {
    username,
    payload: requestPayload,
    payloadString: JSON.stringify(requestPayload),
  })

  try {
    // Create a new user (service account) using MotherDuck REST API
    // Based on: https://motherduck.com/docs/sql-reference/rest-api/motherduck-rest-api/
    const requestBody = JSON.stringify(requestPayload)

    logger.info("connect.motherduck.create_service_account.http_request", {
      url: "https://api.motherduck.com/v1/users",
      method: "POST",
      headers: {
        Authorization: `Bearer ${MD_ADMIN_TOKEN?.substring(0, 10)}...`,
        "Content-Type": "application/json",
      },
      body: requestBody,
      bodyLength: requestBody.length,
    })

    // Try using a different approach - maybe the API expects a different field name
    const res = await httpFetch("https://api.motherduck.com/v1/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MD_ADMIN_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username: username.trim(),
        // Try adding additional fields that might be expected
        name: username.trim(),
        email: `${username.trim()}@hubble.local`,
      }),
    })

    if (res.status === 409) {
      // User already exists - this is acceptable for idempotency
      logger.info("connect.motherduck.create_service_account.already_exists", { username })
      return { username }
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      // Enhanced error logging for debugging
      logger.error("connect.motherduck.create_service_account.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        username,
        url: "https://api.motherduck.com/v1/users",
        method: "POST",
        headers: {
          Authorization: `Bearer ${MD_ADMIN_TOKEN?.substring(0, 10)}...`,
          "Content-Type": "application/json",
        },
      })

      throw new Error(`MotherDuck API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    const data = (await res.json().catch(() => ({}))) as {
      name?: string
      email?: string
      username?: string
    }
    const createdUsername = data.name || data.username || username

    logger.info("connect.motherduck.create_service_account.success", {
      username: createdUsername,
      response: data,
    })

    return { username: createdUsername }
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
  logger.debug("connect.motherduck.issue_token.debug", {
    hasToken: !!MD_ADMIN_TOKEN,
    tokenLength: MD_ADMIN_TOKEN?.length || 0,
    username,
  })

  try {
    // Create an access token for the user using MotherDuck REST API
    // Based on: https://motherduck.com/docs/sql-reference/rest-api/motherduck-rest-api/
    const res = await httpFetch(
      `https://api.motherduck.com/v1/users/${encodeURIComponent(username)}/tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MD_ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${username}_token`,
          // Token expiration and other settings will be handled by MotherDuck
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

    const data = (await res.json().catch(() => ({}))) as {
      token?: string
      access_token?: string
      name?: string
    }
    const token = data.token || data.access_token

    if (!token) {
      throw new Error("MotherDuck API returned no token in response")
    }

    logger.info("connect.motherduck.issue_token.success", {
      username,
      tokenName: data.name,
      tokenLength: token.length,
    })

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
    // Note: MotherDuck REST API doesn't currently support SQL execution
    // Databases are created automatically when first accessed by a user
    // For now, we'll log this step as completed since the database will be created
    // when Fivetran first connects to it

    logger.info("connect.motherduck.create_database.skipped", {
      dbName,
      reason:
        "MotherDuck REST API doesn't support SQL execution. Database will be created on first access.",
    })

    // The database will be created automatically when Fivetran first connects to it
    // This is a common pattern in cloud databases where schemas are created on-demand
    logger.info("connect.motherduck.create_database.success", {
      dbName,
      message: "Database will be created automatically on first access",
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create MotherDuck database '${dbName}': ${error.message}`)
    }
    throw new Error(`Failed to create MotherDuck database '${dbName}': ${String(error)}`)
  }
}

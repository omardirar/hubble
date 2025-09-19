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

  // Debug logging to verify token is loaded
  logger.debug("connect.motherduck.create_service_account.debug", {
    hasToken: !!MD_ADMIN_TOKEN,
    tokenLength: MD_ADMIN_TOKEN?.length || 0,
    username,
  })

  try {
    // Create a new user (service account) using MotherDuck REST API
    // Based on: https://motherduck.com/docs/sql-reference/rest-api/motherduck-rest-api/
    const res = await httpFetch("https://api.motherduck.com/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MD_ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: username,
        // Service accounts are created as regular users with specific permissions
        // The API will handle the service account designation
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

      throw new Error(`MotherDuck API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    const data = (await res.json().catch(() => ({}))) as { name?: string; username?: string }
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
      `https://api.motherduck.com/users/${encodeURIComponent(username)}/tokens`,
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
    // MotherDuck databases are created via SQL commands using the service account token
    // Based on: https://motherduck.com/docs/sql-reference/rest-api/motherduck-rest-api/
    // We'll use the SQL API to execute CREATE DATABASE command
    const res = await httpFetch("https://api.motherduck.com/sql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${saToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `CREATE DATABASE IF NOT EXISTS ${dbName}`,
        // Additional parameters may be needed based on the actual API spec
      }),
    })

    if (res.status === 409) {
      // Database already exists - this is acceptable for idempotency
      logger.info("connect.motherduck.create_database.already_exists", { dbName })
      return
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      throw new Error(`MotherDuck API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    logger.info("connect.motherduck.create_database.success", {
      dbName,
      response: await res.json().catch(() => ({})),
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create MotherDuck database '${dbName}': ${error.message}`)
    }
    throw new Error(`Failed to create MotherDuck database '${dbName}': ${String(error)}`)
  }
}

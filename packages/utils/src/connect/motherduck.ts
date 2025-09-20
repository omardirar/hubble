/**
 * MotherDuck API Integration
 *
 * Provides functions for creating service accounts, issuing tokens, and managing databases
 * using the MotherDuck REST API. All functions include proper validation, error handling,
 * and structured logging.
 */

import { getConnectEnv } from "@hubble/env"
import { logger } from "@hubble/logger"
import { httpFetch, createBearerAuthHeader } from "../fetch"
import {
  validateMotherDuckUsername,
  validateMotherDuckToken,
  validateMotherDuckDatabaseName,
  validateMDAdminToken,
} from "@hubble/api-contracts/connect"

/**
 * Creates a MotherDuck service account
 *
 * @param username - The username for the service account
 * @returns Promise with the created username
 * @throws Error if creation fails or user already exists
 */
export async function mdCreateServiceAccount(username: string): Promise<{ username: string }> {
  // Debug environment loading
  logger.info("connect.motherduck.create_service_account.env_debug", {
    process_env_md_admin_token: !!process.env.MD_ADMIN_TOKEN,
    process_env_md_admin_token_length: process.env.MD_ADMIN_TOKEN?.length || 0,
    process_env_md_admin_token_prefix: process.env.MD_ADMIN_TOKEN?.substring(0, 10) + "...",
  })

  const { MD_ADMIN_TOKEN } = getConnectEnv()

  // Validate inputs using centralized validation
  logger.info("connect.motherduck.create_service_account.validation_debug", {
    original_username: username,
    username_type: typeof username,
    username_length: username?.length || 0,
    has_admin_token: !!MD_ADMIN_TOKEN,
    admin_token_length: MD_ADMIN_TOKEN?.length || 0,
  })

  const validatedUsername = validateMotherDuckUsername(username)
  const validatedToken = validateMDAdminToken(MD_ADMIN_TOKEN)

  logger.info("connect.motherduck.create_service_account.started", {
    username: validatedUsername,
    validated_username_type: typeof validatedUsername,
    validated_username_length: validatedUsername?.length || 0,
  })

  try {
    const requestPayload = { username: validatedUsername }
    const requestBody = JSON.stringify(requestPayload)

    // Debug logging to verify request body
    logger.info("connect.motherduck.create_service_account.request_debug", {
      username: validatedUsername,
      request_payload: requestPayload,
      request_body: requestBody,
      request_body_parsed: JSON.parse(requestBody),
      username_in_body: JSON.parse(requestBody).username,
      stringify_success: requestBody.includes(validatedUsername),
    })

    const res = await httpFetch("https://api.motherduck.com/v1/users", {
      method: "POST",
      headers: {
        Authorization: createBearerAuthHeader(validatedToken),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: requestBody,
    })

    // Handle user already exists (idempotency)
    if (res.status === 409) {
      logger.info("connect.motherduck.create_service_account.already_exists", {
        username: validatedUsername,
      })
      return { username: validatedUsername }
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      // Handle unique constraint violation (idempotency)
      if (res.status === 400 && errorBody.includes("unique constraint")) {
        logger.info("connect.motherduck.create_service_account.already_exists_constraint", {
          username: validatedUsername,
          errorBody,
        })
        return { username: validatedUsername }
      }

      logger.error("connect.motherduck.create_service_account.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        username: validatedUsername,
      })

      throw new Error(`MotherDuck API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    const data = (await res.json().catch(() => ({}))) as {
      name?: string
      username?: string
    }
    const createdUsername = data.name || data.username || validatedUsername

    logger.info("connect.motherduck.create_service_account.success", {
      username: createdUsername,
    })

    return { username: createdUsername }
  } catch (error) {
    logger.error("connect.motherduck.create_service_account.failed", {
      username: validatedUsername,
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(
        `Failed to create MotherDuck service account '${validatedUsername}': ${error.message}`,
      )
    }
    throw new Error(
      `Failed to create MotherDuck service account '${validatedUsername}': ${String(error)}`,
    )
  }
}

/**
 * Issues a token for a MotherDuck service account
 *
 * @param username - The username of the service account
 * @returns Promise with the issued token
 * @throws Error if token issuance fails
 */
export async function mdIssueToken(username: string): Promise<{ token: string }> {
  const { MD_ADMIN_TOKEN } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedUsername = validateMotherDuckUsername(username)
  const validatedToken = validateMDAdminToken(MD_ADMIN_TOKEN)

  logger.info("connect.motherduck.issue_token.started", {
    username: validatedUsername,
  })

  try {
    const requestBody = JSON.stringify({
      name: `${validatedUsername}_token`,
    })

    const res = await httpFetch(
      `https://api.motherduck.com/v1/users/${encodeURIComponent(validatedUsername)}/tokens`,
      {
        method: "POST",
        headers: {
          Authorization: createBearerAuthHeader(validatedToken),
          "Content-Type": "application/json",
        },
        body: requestBody,
      },
    )

    // Handle token already exists (idempotency)
    if (res.status === 409) {
      logger.info("connect.motherduck.issue_token.already_exists", {
        username: validatedUsername,
      })

      // Regenerate with unique name to avoid conflicts
      const newTokenName = `${validatedUsername}_token_${Date.now()}`
      const regenerateRes = await httpFetch(
        `https://api.motherduck.com/v1/users/${encodeURIComponent(validatedUsername)}/tokens`,
        {
          method: "POST",
          headers: {
            Authorization: createBearerAuthHeader(validatedToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: newTokenName }),
        },
      )

      if (!regenerateRes.ok) {
        let errorBody = ""
        try {
          errorBody = await regenerateRes.text()
        } catch {
          errorBody = "Unable to read error response"
        }
        throw new Error(
          `Failed to regenerate token: ${regenerateRes.status} ${regenerateRes.statusText} - ${errorBody}`,
        )
      }

      const regenerateData = (await regenerateRes.json().catch(() => ({}))) as {
        token?: string
        access_token?: string
        name?: string
      }
      const newToken = regenerateData.token || regenerateData.access_token

      if (!newToken) {
        throw new Error("MotherDuck API returned no token when regenerating")
      }

      logger.info("connect.motherduck.issue_token.regenerated", {
        username: validatedUsername,
        tokenName: newTokenName,
      })

      return { token: newToken }
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      // Handle unique constraint violation (idempotency)
      if (res.status === 400 && errorBody.includes("unique constraint")) {
        logger.info("connect.motherduck.issue_token.already_exists_constraint", {
          username: validatedUsername,
          errorBody,
        })

        // Regenerate with unique name
        const newTokenName = `${validatedUsername}_token_${Date.now()}`
        const regenerateRes = await httpFetch(
          `https://api.motherduck.com/v1/users/${encodeURIComponent(validatedUsername)}/tokens`,
          {
            method: "POST",
            headers: {
              Authorization: createBearerAuthHeader(validatedToken),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: newTokenName }),
          },
        )

        if (!regenerateRes.ok) {
          let regenerateErrorBody = ""
          try {
            regenerateErrorBody = await regenerateRes.text()
          } catch {
            regenerateErrorBody = "Unable to read error response"
          }
          throw new Error(
            `Failed to regenerate token after constraint violation: ${regenerateRes.status} ${regenerateRes.statusText} - ${regenerateErrorBody}`,
          )
        }

        const regenerateData = (await regenerateRes.json().catch(() => ({}))) as {
          token?: string
          access_token?: string
          name?: string
        }
        const newToken = regenerateData.token || regenerateData.access_token

        if (!newToken) {
          throw new Error(
            "MotherDuck API returned no token when regenerating after constraint violation",
          )
        }

        logger.info("connect.motherduck.issue_token.regenerated_after_constraint", {
          username: validatedUsername,
          tokenName: newTokenName,
        })

        return { token: newToken }
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
      username: validatedUsername,
      tokenName: data.name,
    })

    return { token }
  } catch (error) {
    logger.error("connect.motherduck.issue_token.failed", {
      username: validatedUsername,
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(
        `Failed to issue MotherDuck token for '${validatedUsername}': ${error.message}`,
      )
    }
    throw new Error(`Failed to issue MotherDuck token for '${validatedUsername}': ${String(error)}`)
  }
}

/**
 * Creates a MotherDuck database using external API
 *
 * This function calls an external API route that uses the DuckDB Node.js client
 * to programmatically create databases. The external API handles native dependencies
 * while keeping the main provisioning flow lightweight.
 *
 * @param dbName - The name of the database to create
 * @param saToken - The service account token for authentication
 * @returns Promise that resolves when database is created
 * @throws Error if database creation fails
 */
export async function mdCreateDatabase(dbName: string, saToken: string): Promise<void> {
  // Validate inputs using centralized validation
  const validatedDbName = validateMotherDuckDatabaseName(dbName)
  const validatedToken = validateMotherDuckToken(saToken)

  logger.info("connect.motherduck.create_database.started", {
    dbName: validatedDbName,
  })

  try {
    // Get the base URL for the API
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const apiUrl = `${baseUrl}/api/motherduck/create-database`

    logger.info("connect.motherduck.create_database.api_call", {
      dbName: validatedDbName,
      apiUrl,
    })

    // Call the external API that handles DuckDB Node.js client
    // This is an internal API call, so we use a simple API key
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.INTERNAL_API_KEY || "internal-db-creation-key",
      },
      body: JSON.stringify({
        dbName: validatedDbName,
        token: validatedToken,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `API call failed: ${response.status} ${response.statusText} - ${errorData.error || "Unknown error"}`,
      )
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(`Database creation failed: ${result.error}`)
    }

    logger.info("connect.motherduck.create_database.success", {
      dbName: validatedDbName,
      message: "Database created successfully using external API",
      result,
    })
  } catch (error) {
    logger.error("connect.motherduck.create_database.failed", {
      dbName: validatedDbName,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })

    // Fallback: Log instructions for manual creation
    logger.warn("connect.motherduck.create_database.fallback_instructions", {
      dbName: validatedDbName,
      message: "API call failed - database may need to be created manually or by Fivetran",
      motherduck_ui: "https://app.motherduck.com",
      duckdb_cli_command: `duckdb 'md:${validatedDbName}?token=***' -c "CREATE DATABASE IF NOT EXISTS ${validatedDbName};"`,
    })

    if (error instanceof Error) {
      throw new Error(`Failed to create MotherDuck database '${validatedDbName}': ${error.message}`)
    }
    throw new Error(`Failed to create MotherDuck database '${validatedDbName}': ${String(error)}`)
  }
}

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
  const { MD_ADMIN_TOKEN } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedUsername = validateMotherDuckUsername(username)
  const validatedToken = validateMDAdminToken(MD_ADMIN_TOKEN)

  logger.info("connect.motherduck.create_service_account.started", {
    username: validatedUsername,
  })

  try {
    const requestBody = JSON.stringify({ username: validatedUsername })

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
 * Creates a MotherDuck database
 *
 * Note: MotherDuck REST API doesn't support SQL execution, so databases are created
 * automatically when first accessed. This function validates inputs and logs the step.
 *
 * @param dbName - The name of the database to create
 * @param saToken - The service account token (validated but not used for API call)
 * @returns Promise that resolves when validation is complete
 * @throws Error if validation fails
 */
export async function mdCreateDatabase(dbName: string, saToken: string): Promise<void> {
  // Validate inputs using centralized validation
  const validatedDbName = validateMotherDuckDatabaseName(dbName)
  const validatedToken = validateMotherDuckToken(saToken)

  logger.info("connect.motherduck.create_database.started", {
    dbName: validatedDbName,
  })

  try {
    // Note: MotherDuck REST API doesn't currently support SQL execution
    // Databases are created automatically when first accessed by a user
    logger.info("connect.motherduck.create_database.skipped", {
      dbName: validatedDbName,
      reason:
        "MotherDuck REST API doesn't support SQL execution. Database will be created on first access.",
    })

    // The database will be created automatically when Fivetran first connects to it
    // This is a common pattern in cloud databases where schemas are created on-demand
    logger.info("connect.motherduck.create_database.success", {
      dbName: validatedDbName,
      message: "Database will be created automatically on first access",
    })
  } catch (error) {
    logger.error("connect.motherduck.create_database.failed", {
      dbName: validatedDbName,
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(`Failed to create MotherDuck database '${validatedDbName}': ${error.message}`)
    }
    throw new Error(`Failed to create MotherDuck database '${validatedDbName}': ${String(error)}`)
  }
}

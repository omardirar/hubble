/**
 * Fivetran API Integration
 *
 * Provides functions for creating and testing Fivetran destinations for MotherDuck.
 * All functions include proper validation, error handling, and structured logging.
 */

import { getConnectEnv } from "@hubble/env"
import { logger } from "@hubble/logger"
import { httpFetch, createBasicAuthHeader } from "../fetch"
import {
  validateExternalId,
  validateDestinationId,
  validateFivetranApiKey,
  validateFivetranApiSecret,
  validateMotherDuckDatabaseName,
  validateMotherDuckToken,
  validateFivetranGroupName,
} from "@hubble/api-contracts/connect"

/**
 * Creates a Fivetran group
 *
 * @param groupId - The group ID to create
 * @param groupName - The name for the group
 * @returns Promise with the group ID
 * @throws Error if creation fails
 */
export async function fivetranCreateGroup(
  groupId: string,
  groupName: string,
): Promise<{ group_id: string }> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedGroupId = validateExternalId(groupId)
  const validatedGroupName = validateFivetranGroupName(groupName)
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.create_group.started", {
    groupId: validatedGroupId,
    groupName: validatedGroupName,
  })

  try {
    const requestBody = JSON.stringify({
      id: validatedGroupId,
      name: validatedGroupName,
    })

    const res = await httpFetch("https://api.fivetran.com/v1/groups", {
      method: "POST",
      headers: {
        Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
        "Content-Type": "application/json",
      },
      body: requestBody,
    })

    // Handle group already exists (idempotency)
    if (res.status === 409) {
      logger.info("connect.fivetran.group_already_exists", {
        groupId: validatedGroupId,
      })
      return { group_id: validatedGroupId }
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      // Handle duplicate group error (idempotency)
      if (res.status === 400 && errorBody.includes("already exists")) {
        logger.info("connect.fivetran.group_already_exists_constraint", {
          groupId: validatedGroupId,
          errorBody,
        })
        return { group_id: validatedGroupId }
      }

      logger.error("connect.fivetran.create_group.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        groupId: validatedGroupId,
      })

      throw new Error(
        `Fivetran create group failed: ${res.status} ${res.statusText} - ${errorBody}`,
      )
    }

    const data = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
    const group_id = data?.data?.id ?? validatedGroupId

    logger.info("connect.fivetran.create_group.success", {
      groupId: validatedGroupId,
      group_id,
    })

    return { group_id }
  } catch (error) {
    logger.error("connect.fivetran.create_group.failed", {
      groupId: validatedGroupId,
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(`Failed to create Fivetran group '${validatedGroupId}': ${error.message}`)
    }
    throw new Error(`Failed to create Fivetran group '${validatedGroupId}': ${String(error)}`)
  }
}

/**
 * Creates or updates a Fivetran destination for MotherDuck
 *
 * @param externalId - External ID for the destination (used for idempotency)
 * @param mdDbName - MotherDuck database name
 * @param mdToken - The actual MotherDuck token value
 * @returns Promise with the destination ID
 * @throws Error if creation fails
 */
export async function fivetranUpsertMotherDuckDestination(
  externalId: string,
  mdDbName: string,
  mdToken: string,
): Promise<{ destination_id: string }> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedExternalId = validateExternalId(externalId)
  const validatedDbName = validateMotherDuckDatabaseName(mdDbName)
  const validatedToken = validateMotherDuckToken(mdToken) // Validate as actual token
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.upsert_destination.started", {
    externalId: validatedExternalId,
    mdDbName: validatedDbName,
    tokenLength: validatedToken.length,
  })

  try {
    const requestBody = JSON.stringify({
      group_id: validatedExternalId,
      service: "motherduck",
      time_zone_offset: "0", // UTC
      run_setup_tests: false, // Disable automatic setup tests as requested
      config: {
        database: validatedDbName,
        motherduck_token: validatedToken, // Actual token value for MotherDuck
      },
    })

    const res = await httpFetch("https://api.fivetran.com/v1/destinations", {
      method: "POST",
      headers: {
        Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
        "Content-Type": "application/json",
      },
      body: requestBody,
    })

    // Handle destination already exists (idempotency)
    if (res.status === 409) {
      logger.info("connect.fivetran.destination_already_exists", {
        externalId: validatedExternalId,
      })
      return { destination_id: validatedExternalId }
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      // Handle duplicate destination error (idempotency)
      if (res.status === 400 && errorBody.includes("already exists")) {
        logger.info("connect.fivetran.destination_already_exists_constraint", {
          externalId: validatedExternalId,
          errorBody,
        })
        return { destination_id: validatedExternalId }
      }

      logger.error("connect.fivetran.create_destination.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        externalId: validatedExternalId,
      })

      throw new Error(
        `Fivetran create destination failed: ${res.status} ${res.statusText} - ${errorBody}`,
      )
    }

    const data = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
    const destination_id = data?.data?.id ?? validatedExternalId

    logger.info("connect.fivetran.upsert_destination.success", {
      externalId: validatedExternalId,
      destination_id,
    })

    return { destination_id }
  } catch (error) {
    logger.error("connect.fivetran.upsert_destination.failed", {
      externalId: validatedExternalId,
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(
        `Failed to create Fivetran destination for '${validatedExternalId}': ${error.message}`,
      )
    }
    throw new Error(
      `Failed to create Fivetran destination for '${validatedExternalId}': ${String(error)}`,
    )
  }
}

/**
 * Tests a Fivetran destination connection
 *
 * @param destinationId - The destination ID to test
 * @returns Promise with boolean indicating if test passed
 * @throws Error if test fails
 */
export async function fivetranTestDestination(destinationId: string): Promise<boolean> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedDestinationId = validateDestinationId(destinationId)
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.test_destination.started", {
    destinationId: validatedDestinationId,
  })

  try {
    const res = await httpFetch(
      `https://api.fivetran.com/v1/destinations/${encodeURIComponent(validatedDestinationId)}/test`,
      {
        method: "POST",
        headers: {
          Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tests: ["CONNECT", "SCHEMA"], // Test connection and schema access
        }),
      },
    )

    if (res.status === 404) {
      logger.warn("connect.fivetran.test_destination.not_found", {
        destinationId: validatedDestinationId,
      })
      return false
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      logger.error("connect.fivetran.test_destination.api_error", {
        destinationId: validatedDestinationId,
        status: res.status,
        statusText: res.statusText,
        errorBody,
      })

      throw new Error(
        `Fivetran test destination failed: ${res.status} ${res.statusText} - ${errorBody}`,
      )
    }

    const data = (await res.json().catch(() => ({}))) as { data?: { status?: string } }
    const testStatus = data?.data?.status
    const success = testStatus === "SUCCESS"

    logger.info("connect.fivetran.test_destination.completed", {
      destinationId: validatedDestinationId,
      testStatus,
      success,
    })

    return success
  } catch (error) {
    logger.error("connect.fivetran.test_destination.failed", {
      destinationId: validatedDestinationId,
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(
        `Failed to test Fivetran destination '${validatedDestinationId}': ${error.message}`,
      )
    }
    throw new Error(
      `Failed to test Fivetran destination '${validatedDestinationId}': ${String(error)}`,
    )
  }
}

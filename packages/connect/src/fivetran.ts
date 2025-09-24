/**
 * Fivetran API Integration
 *
 * Provides functions for creating and testing Fivetran destinations for MotherDuck.
 * All functions include proper validation, error handling, and structured logging.
 */

import { getConnectEnv } from "@hubble/config"
import { logger } from "@hubble/logger"
import { httpFetch, createBasicAuthHeader } from "@hubble/core"
import {
  validateExternalId,
  validateDestinationId,
  validateFivetranApiKey,
  validateFivetranApiSecret,
  validateMotherDuckDatabaseName,
  validateMotherDuckToken,
  validateFivetranGroupName,
} from "@hubble/schemas/connect"

/**
 * Lists all Fivetran groups
 *
 * @returns Promise with array of groups
 * @throws Error if listing fails
 */
export async function fivetranListGroups(): Promise<{ id: string; name: string }[]> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.list_groups.started")

  try {
    const res = await httpFetch("https://api.fivetran.com/v1/groups", {
      method: "GET",
      headers: {
        Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
        "Content-Type": "application/json",
      },
      timeoutMs: 30000, // 30 seconds for listing groups
    })

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      logger.error("connect.fivetran.list_groups.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
      })

      throw new Error(`Fivetran list groups failed: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    const data = (await res.json().catch(() => ({}))) as {
      data?: { items?: { id?: string; name?: string }[] }
    }
    const groups = data?.data?.items ?? []

    logger.info("connect.fivetran.list_groups.success", {
      groupCount: groups.length,
    })

    return groups.map((group) => ({
      id: group.id ?? "",
      name: group.name ?? "",
    }))
  } catch (error) {
    logger.error("connect.fivetran.list_groups.failed", {
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(`Failed to list Fivetran groups: ${error.message}`)
    }
    throw new Error(`Failed to list Fivetran groups: ${String(error)}`)
  }
}

/**
 * Retrieves a Fivetran group by ID
 *
 * @param groupId - The group ID to retrieve
 * @returns Promise with the group details or null if not found
 * @throws Error if retrieval fails (other than 404)
 */
export async function fivetranGetGroup(
  groupId: string,
): Promise<{ id: string; name: string } | null> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedGroupId = validateExternalId(groupId)
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  try {
    const res = await httpFetch(
      `https://api.fivetran.com/v1/groups/${encodeURIComponent(validatedGroupId)}`,
      {
        method: "GET",
        headers: {
          Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
          "Content-Type": "application/json",
        },
        timeoutMs: 30000, // 30 seconds for getting group details
      },
    )

    if (res.status === 404) {
      return null
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      logger.error("connect.fivetran.get_group.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        groupId: validatedGroupId,
      })

      throw new Error(`Fivetran get group failed: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    const data = (await res.json().catch(() => ({}))) as { data?: { id?: string; name?: string } }
    const group = data?.data

    if (!group?.id) {
      logger.warn("connect.fivetran.get_group.invalid_response", {
        groupId: validatedGroupId,
        response: data,
      })
      return null
    }

    logger.info("connect.fivetran.get_group.success", {
      groupId: validatedGroupId,
      groupName: group.name,
    })

    return {
      id: group.id,
      name: group.name ?? "",
    }
  } catch (error) {
    logger.error("connect.fivetran.get_group.failed", {
      groupId: validatedGroupId,
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(`Failed to get Fivetran group '${validatedGroupId}': ${error.message}`)
    }
    throw new Error(`Failed to get Fivetran group '${validatedGroupId}': ${String(error)}`)
  }
}

/**
 * Creates a Fivetran group
 *
 * @param groupId - The group ID to create
 * @param groupName - The name for the group
 * @returns Promise with the group ID
 * @throws Error if creation fails
 */
// TODO: Add retry logic with exponential backoff
//   Context: Implement retry logic for Fivetran API calls to handle transient failures.
//   labels: area/utils, feature/connect, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

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

  // Check if group already exists (idempotency)
  try {
    const existingGroup = await fivetranGetGroup(validatedGroupId)
    if (existingGroup) {
      logger.info("connect.fivetran.group_already_exists", {
        groupId: validatedGroupId,
        groupName: existingGroup.name,
      })
      return { group_id: existingGroup.id }
    }
  } catch (getError) {
    logger.warn("connect.fivetran.group_lookup_failed", {
      groupId: validatedGroupId,
      error: getError instanceof Error ? getError.message : String(getError),
    })
    // Continue with creation if lookup fails
  }

  try {
    const requestBody = JSON.stringify({
      name: validatedGroupName,
    })

    const res = await httpFetch("https://api.fivetran.com/v1/groups", {
      method: "POST",
      headers: {
        Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
        "Content-Type": "application/json",
      },
      body: requestBody,
      timeoutMs: 30000, // 30 seconds for group creation
    })

    // Handle group already exists (idempotency)
    if (res.status === 409) {
      logger.info("connect.fivetran.group_already_exists_409", {
        groupName: validatedGroupName,
      })
      // If we get a 409, the group might exist but with a different ID
      // Try to get the group by name (we'd need to implement this)
      throw new Error(
        "Group already exists with different ID - need to implement name-based lookup",
      )
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      // Handle duplicate group error (idempotency)
      if (res.status === 400) {
        try {
          const errorData = JSON.parse(errorBody)
          if (errorData.code === "InvalidInput" && errorData.message?.includes("already in use")) {
            logger.info("connect.fivetran.group_already_exists_invalid_input", {
              groupName: validatedGroupName,
              errorBody,
            })
            // Find the existing group by name
            logger.info("connect.fivetran.group_name_already_in_use", {
              groupName: validatedGroupName,
            })
            try {
              const existingGroups = await fivetranListGroups()
              const existingGroup = existingGroups.find(
                (group) => group.name === validatedGroupName,
              )
              if (existingGroup) {
                logger.info("connect.fivetran.group_found_by_name", {
                  groupName: validatedGroupName,
                  groupId: existingGroup.id,
                })
                return { group_id: existingGroup.id }
              } else {
                logger.error("connect.fivetran.group_not_found_by_name", {
                  groupName: validatedGroupName,
                  availableGroups: existingGroups.map((g) => g.name),
                })
                throw new Error(
                  `Group with name '${validatedGroupName}' not found in existing groups`,
                )
              }
            } catch (listError) {
              logger.error("connect.fivetran.group_lookup_by_name_failed", {
                groupName: validatedGroupName,
                error: listError instanceof Error ? listError.message : String(listError),
              })
              throw new Error(
                `Failed to find existing group by name: ${listError instanceof Error ? listError.message : String(listError)}`,
              )
            }
          }
        } catch {
          // Fallback to string matching if JSON parsing fails
          if (errorBody.includes("already exists") || errorBody.includes("already in use")) {
            logger.info("connect.fivetran.group_already_exists_constraint", {
              groupName: validatedGroupName,
              errorBody,
            })
            // Find the existing group by name (fallback)
            logger.info("connect.fivetran.group_name_already_in_use_fallback", {
              groupName: validatedGroupName,
            })
            try {
              const existingGroups = await fivetranListGroups()
              const existingGroup = existingGroups.find(
                (group) => group.name === validatedGroupName,
              )
              if (existingGroup) {
                logger.info("connect.fivetran.group_found_by_name_fallback", {
                  groupName: validatedGroupName,
                  groupId: existingGroup.id,
                })
                return { group_id: existingGroup.id }
              } else {
                logger.error("connect.fivetran.group_not_found_by_name_fallback", {
                  groupName: validatedGroupName,
                  availableGroups: existingGroups.map((g) => g.name),
                })
                throw new Error(
                  `Group with name '${validatedGroupName}' not found in existing groups`,
                )
              }
            } catch (listError) {
              logger.error("connect.fivetran.group_lookup_by_name_failed_fallback", {
                groupName: validatedGroupName,
                error: listError instanceof Error ? listError.message : String(listError),
              })
              throw new Error(
                `Failed to find existing group by name: ${listError instanceof Error ? listError.message : String(listError)}`,
              )
            }
          }
        }
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
    const group_id = data?.data?.id

    if (!group_id) {
      logger.error("connect.fivetran.create_group.no_id_returned", {
        groupName: validatedGroupName,
        api_response: data,
      })
      throw new Error("Fivetran did not return a group ID in the response")
    }

    logger.info("connect.fivetran.create_group.success", {
      groupName: validatedGroupName,
      group_id,
      api_response: data,
    })

    return { group_id }
  } catch (error) {
    logger.error("connect.fivetran.create_group.failed", {
      groupName: validatedGroupName,
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      throw new Error(`Failed to create Fivetran group '${validatedGroupName}': ${error.message}`)
    }
    throw new Error(`Failed to create Fivetran group '${validatedGroupName}': ${String(error)}`)
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
        motherduck_database: validatedDbName, // Correct field name for Fivetran API
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
      timeoutMs: 60000, // 60 seconds for destination creation
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
 * Get connector-specific configuration
 * Based on Fivetran documentation for each connector type
 *
 * @param service - The service name (e.g., 'facebook_ads', 'google_ads')
 * @returns Config object for the connector
 */
function getConnectorConfig(service: string): Record<string, unknown> {
  switch (service) {
    case "facebook_ads":
      return {
        // Facebook Ads requires these fields
        schema: "facebook_ads",
        timeframe_months: "TWELVE",
        sync_mode: "SpecificAccounts", // Correct enum value
        accounts: [],
        // Additional fields will be filled through Connect Card
      }
    case "google_ads":
      return {
        // Google Ads requires these fields
        schema: "google_ads",
        timeframe_months: "TWELVE",
        sync_mode: "SpecificAccounts", // Correct enum value
        accounts: [],
        // Additional fields will be filled through Connect Card
      }
    case "tiktok_ads":
      return {
        // TikTok Ads requires these fields
        schema: "tiktok_ads",
        timeframe_months: "TWELVE",
        sync_mode: "SpecificAccounts", // Correct enum value
        accounts: [],
        // Additional fields will be filled through Connect Card
      }
    case "linkedin_ads":
      return {
        // LinkedIn Ads requires these fields
        schema: "linkedin_ads",
        timeframe_months: "TWELVE",
        sync_mode: "SpecificAccounts", // Correct enum value
        accounts: [],
        // Additional fields will be filled through Connect Card
      }
    default:
      // Generic config for unknown services
      return {
        schema: service,
        timeframe_months: "TWELVE",
        sync_mode: "SpecificAccounts", // Correct enum value
        accounts: [],
      }
  }
}

/**
 * Create a Fivetran connection using Connect Card approach
 * Based on Fivetran sample project: https://github.com/fivetran/fivetran-connect-card-sample-js
 * Following the exact pattern from the sample project's ApiClient class
 *
 * @param groupId - The group ID for the connection
 * @param service - The service name (e.g., 'facebook_ads', 'google_ads')
 * @param redirectUrl - Optional redirect URL after setup
 * @returns Promise with connection ID and Connect Card URI
 */
export async function fivetranCreateConnection(
  groupId: string,
  service: string,
  redirectUrl?: string,
): Promise<{ connection_id: string; connect_card_uri: string }> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedGroupId = validateExternalId(groupId)
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.create_connection.started", {
    group_id: validatedGroupId,
    service,
  })

  try {
    // Create connection with Connect Card config in a single request
    // Following the sample project's approach of including connect_card_config in the initial request
    const requestBody = JSON.stringify({
      group_id: validatedGroupId,
      service,
      config: getConnectorConfig(service),
      connect_card_config: {
        redirect_uri: redirectUrl,
      },
    })

    const res = await httpFetch("https://api.fivetran.com/v1/connections", {
      method: "POST",
      headers: {
        Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
        "Content-Type": "application/json",
        Accept: "application/json;version=2",
      },
      body: requestBody,
      timeoutMs: 60000,
    })

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      logger.error("connect.fivetran.create_connection.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        group_id: validatedGroupId,
        service,
      })

      throw new Error(
        `Fivetran create connection failed: ${res.status} ${res.statusText} - ${errorBody}`,
      )
    }

    const responseData = await res.json()
    const connectionId = responseData.data.id
    const connectCardUri = responseData.data.connect_card?.uri

    if (!connectCardUri) {
      logger.error("connect.fivetran.create_connection.no_connect_card", {
        connection_id: connectionId,
        response_data: responseData,
      })
      throw new Error("No Connect Card URI returned from Fivetran API")
    }

    logger.info("connect.fivetran.create_connection.succeeded", {
      connection_id: connectionId,
      connect_card_uri: connectCardUri,
      group_id: validatedGroupId,
      service,
    })

    return {
      connection_id: connectionId,
      connect_card_uri: connectCardUri,
    }
  } catch (error) {
    logger.error("connect.fivetran.create_connection.failed", {
      error: error instanceof Error ? error.message : String(error),
      group_id: validatedGroupId,
      service,
    })
    throw new Error(
      `Failed to create Fivetran connection: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Get Connect Card URL for existing connection
 * Based on Fivetran sample project pattern
 *
 * @param connectionId - The connection ID
 * @param redirectUrl - Optional redirect URL after setup
 * @returns Promise with Connect Card URL
 */
export async function fivetranGetConnectCardUrl(
  connectionId: string,
  redirectUrl?: string,
): Promise<{ connect_card_uri: string }> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.get_connect_card.started", {
    connection_id: connectionId,
  })

  try {
    const requestBody = JSON.stringify({
      connect_card_config: {
        redirect_uri: redirectUrl,
      },
    })

    const res = await httpFetch(
      `https://api.fivetran.com/v1/connections/${connectionId}/connect-card`,
      {
        method: "POST",
        headers: {
          Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
          "Content-Type": "application/json",
          Accept: "application/json;version=2",
        },
        body: requestBody,
        timeoutMs: 60000,
      },
    )

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      logger.error("connect.fivetran.get_connect_card.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        connection_id: connectionId,
      })

      throw new Error(
        `Fivetran get connect card failed: ${res.status} ${res.statusText} - ${errorBody}`,
      )
    }

    const responseData = await res.json()
    const connectCardUri = responseData.data.connect_card?.uri

    if (!connectCardUri) {
      logger.error("connect.fivetran.get_connect_card.no_uri", {
        connection_id: connectionId,
        response_data: responseData,
      })
      throw new Error("No Connect Card URI returned from Fivetran API")
    }

    logger.info("connect.fivetran.get_connect_card.succeeded", {
      connection_id: connectionId,
      connect_card_uri: connectCardUri,
    })

    return {
      connect_card_uri: connectCardUri,
    }
  } catch (error) {
    logger.error("connect.fivetran.get_connect_card.failed", {
      error: error instanceof Error ? error.message : String(error),
      connection_id: connectionId,
    })
    throw new Error(
      `Failed to get Fivetran Connect Card: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Get list of connections in a group
 * Based on Fivetran sample project pattern
 *
 * @param groupId - The group ID
 * @returns Promise with list of connections
 */
export async function fivetranGetConnections(groupId: string): Promise<
  Array<{
    id: string
    service: string
    status: string
    created_at: string
    connect_card?: { uri: string }
  }>
> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  const validatedGroupId = validateExternalId(groupId)
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.get_connections.started", {
    group_id: validatedGroupId,
  })

  try {
    const res = await httpFetch(
      `https://api.fivetran.com/v1/connections?group_id=${validatedGroupId}`,
      {
        method: "GET",
        headers: {
          Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
          Accept: "application/json;version=2",
        },
        timeoutMs: 60000,
      },
    )

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      logger.error("connect.fivetran.get_connections.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        group_id: validatedGroupId,
      })

      throw new Error(
        `Fivetran get connections failed: ${res.status} ${res.statusText} - ${errorBody}`,
      )
    }

    const responseData = await res.json()
    const connections = responseData.data?.items || []

    logger.info("connect.fivetran.get_connections.succeeded", {
      group_id: validatedGroupId,
      count: connections.length,
    })

    return connections
  } catch (error) {
    logger.error("connect.fivetran.get_connections.failed", {
      error: error instanceof Error ? error.message : String(error),
      group_id: validatedGroupId,
    })
    throw new Error(
      `Failed to get Fivetran connections: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Generate Fivetran Connect Card URL for existing connector setup
 * Legacy function - use fivetranGetConnectCardUrl for new implementations
 *
 * @param connectorId - The connector ID
 * @param redirectUrl - Optional redirect URL after setup
 * @returns Connect Card URL for embedded setup
 * @deprecated Use fivetranGetConnectCardUrl instead
 */
export function fivetranGenerateConnectCardUrl(connectorId: string, redirectUrl?: string): string {
  const baseUrl = "https://fivetran.com/connect-card"
  const params = new URLSearchParams({
    connector_id: connectorId,
  })

  if (redirectUrl) {
    params.set("redirect_url", redirectUrl)
  }

  return `${baseUrl}?${params.toString()}`
}

/**
 * Creates a Fivetran connector (deprecated - use Connect Card instead)
 *
 * @param groupId - The group ID for the connector
 * @param service - The service name (e.g., 'facebook_ads', 'google_ads')
 * @param config - The connector configuration
 * @returns Promise with the connector ID
 * @throws Error if creation fails
 * @deprecated Use Connect Card approach instead
 */
export async function fivetranCreateConnector(
  groupId: string,
  service: string,
  config: Record<string, unknown>,
): Promise<{ connector_id: string }> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedGroupId = validateExternalId(groupId)
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.create_connector.started", {
    group_id: validatedGroupId,
    service,
    config_keys: Object.keys(config),
  })

  try {
    const requestBody = JSON.stringify({
      group_id: validatedGroupId,
      service,
      config,
      run_setup_tests: false, // Disable automatic setup tests
    })

    const res = await httpFetch("https://api.fivetran.com/v1/connectors", {
      method: "POST",
      headers: {
        Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
        "Content-Type": "application/json",
      },
      body: requestBody,
      timeoutMs: 60000, // 60 seconds for connector creation
    })

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      logger.error("connect.fivetran.create_connector.api_error", {
        status: res.status,
        statusText: res.statusText,
        errorBody,
        group_id: validatedGroupId,
        service,
      })

      throw new Error(
        `Fivetran create connector failed: ${res.status} ${res.statusText} - ${errorBody}`,
      )
    }

    const data = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
    const connector_id = data?.data?.id ?? ""

    if (!connector_id) {
      throw new Error("Fivetran API returned empty connector ID")
    }

    logger.info("connect.fivetran.create_connector.success", {
      group_id: validatedGroupId,
      service,
      connector_id,
    })

    return { connector_id }
  } catch (error) {
    logger.error("connect.fivetran.create_connector.failed", {
      error: error instanceof Error ? error.message : String(error),
      group_id: validatedGroupId,
      service,
    })

    if (error instanceof Error) {
      throw new Error(`Failed to create Fivetran connector: ${error.message}`)
    }
    throw new Error(`Failed to create Fivetran connector: ${String(error)}`)
  }
}

/**
 * Gets a Fivetran connector by ID
 *
 * @param connectorId - The connector ID to retrieve
 * @returns Promise with the connector details or null if not found
 * @throws Error if retrieval fails (other than 404)
 */
export async function fivetranGetConnector(connectorId: string): Promise<{
  id: string
  service: string
  schema: string
  status: string
  connected_by: string
  created_at: string
  succeeded_at: string | null
  failed_at: string | null
} | null> {
  const { FIVETRAN_API_KEY, FIVETRAN_API_SECRET } = getConnectEnv()

  // Validate inputs using centralized validation
  const validatedConnectorId = validateExternalId(connectorId)
  const validatedApiKey = validateFivetranApiKey(FIVETRAN_API_KEY)
  const validatedApiSecret = validateFivetranApiSecret(FIVETRAN_API_SECRET)

  logger.info("connect.fivetran.get_connector.started", {
    connector_id: validatedConnectorId,
  })

  try {
    const res = await httpFetch(
      `https://api.fivetran.com/v1/connectors/${encodeURIComponent(validatedConnectorId)}`,
      {
        method: "GET",
        headers: {
          Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
          "Content-Type": "application/json",
        },
        timeoutMs: 30000, // 30 seconds for connector retrieval
      },
    )

    if (res.status === 404) {
      logger.warn("connect.fivetran.get_connector.not_found", {
        connector_id: validatedConnectorId,
      })
      return null
    }

    if (!res.ok) {
      let errorBody = ""
      try {
        errorBody = await res.text()
      } catch {
        errorBody = "Unable to read error response"
      }

      logger.error("connect.fivetran.get_connector.api_error", {
        connector_id: validatedConnectorId,
        status: res.status,
        statusText: res.statusText,
        errorBody,
      })

      throw new Error(
        `Fivetran get connector failed: ${res.status} ${res.statusText} - ${errorBody}`,
      )
    }

    const data = (await res.json().catch(() => ({}))) as {
      data?: {
        id?: string
        service?: string
        schema?: string
        status?: string
        connected_by?: string
        created_at?: string
        succeeded_at?: string | null
        failed_at?: string | null
      }
    }

    const connector = data?.data
    if (!connector?.id) {
      logger.warn("connect.fivetran.get_connector.invalid_response", {
        connector_id: validatedConnectorId,
        response: data,
      })
      return null
    }

    logger.info("connect.fivetran.get_connector.success", {
      connector_id: validatedConnectorId,
      service: connector.service,
      status: connector.status,
    })

    return {
      id: connector.id,
      service: connector.service ?? "",
      schema: connector.schema ?? "",
      status: connector.status ?? "",
      connected_by: connector.connected_by ?? "",
      created_at: connector.created_at ?? "",
      succeeded_at: connector.succeeded_at ?? null,
      failed_at: connector.failed_at ?? null,
    }
  } catch (error) {
    logger.error("connect.fivetran.get_connector.failed", {
      error: error instanceof Error ? error.message : String(error),
      connector_id: validatedConnectorId,
    })

    if (error instanceof Error) {
      throw new Error(`Failed to get Fivetran connector: ${error.message}`)
    }
    throw new Error(`Failed to get Fivetran connector: ${String(error)}`)
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

  try {
    const res = await httpFetch(
      `https://api.fivetran.com/v1/destinations/${encodeURIComponent(validatedDestinationId)}/test`,
      {
        method: "POST",
        headers: {
          Authorization: createBasicAuthHeader(validatedApiKey, validatedApiSecret),
          Accept: "application/json;version=2",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trust_certificates: true,
          trust_fingerprints: true,
        }),
        timeoutMs: 300000, // 300 seconds for destination testing (setup tests can take time)
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

    const data = (await res.json().catch(() => ({}))) as {
      data?: {
        setup_status?: string
        setup_tests?: Array<{
          title: string
          status: "PASSED" | "SKIPPED" | "WARNING" | "FAILED" | "JOB_FAILED"
          message?: string
        }>
      }
    }

    const setupStatus = data?.data?.setup_status
    const setupTests = data?.data?.setup_tests || []

    // Check if all tests passed
    const allTestsPassed =
      setupTests.length > 0 && setupTests.every((test) => test.status === "PASSED")
    const hasFailedTests = setupTests.some(
      (test) => test.status === "FAILED" || test.status === "JOB_FAILED",
    )

    // Success if setup status is CONNECTED and all tests passed
    const success = setupStatus?.toUpperCase() === "CONNECTED" && allTestsPassed && !hasFailedTests

    logger.info("connect.fivetran.test_destination.completed", {
      destinationId: validatedDestinationId,
      setupStatus,
      testCount: setupTests.length,
      allTestsPassed,
      hasFailedTests,
      success,
      testResults: setupTests.map((test) => ({
        title: test.title,
        status: test.status,
        message: test.message,
      })),
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

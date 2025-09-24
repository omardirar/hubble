/**
 * Client-side Connect Functions
 *
 * This module provides client-side functions for managing data connections
 * that can be safely imported in browser environments.
 */

import { logger } from "@hubble/logger"

/**
 * Get available connector types from the API
 */
export async function getConnectorTypesClient(): Promise<Array<{ code: string; label: string }>> {
  try {
    const response = await fetch("/api/connect/connector-types")

    if (!response.ok) {
      throw new Error(`Failed to fetch connector types: ${response.status}`)
    }

    const data = await response.json()
    return data.connector_types || []
  } catch (error) {
    logger.error("connect.client.get_connector_types_failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Get data connections for the current organization from the API
 */
export async function getDataConnectionsClient(
  orgId: string,
  authToken: string,
): Promise<
  Array<{
    id: string
    source_type: string
    fivetran_connector_id: string | null
    schema_name: string | null
    status: string
    created_at: string
    updated_at: string
  }>
> {
  try {
    const response = await fetch("/api/connect/connections", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch data connections: ${response.status}`)
    }

    const data = await response.json()
    return data.connections || []
  } catch (error) {
    logger.error("connect.client.get_data_connections_failed", {
      error: error instanceof Error ? error.message : String(error),
      orgId,
    })
    throw error
  }
}

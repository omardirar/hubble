/**
 * Fivetran Health Monitoring
 *
 * Provides TypeScript interfaces and helper functions for querying Fivetran
 * connection health data from database views.
 *
 * Data comes from the fivetran_log connector which syncs Fivetran metadata
 * to your database.
 */

import { createBrowserClient, createServiceClient } from "@hubble/db"
import { logger } from "@hubble/logger"

// =============================================================================
// Types
// =============================================================================
//
// IMPORTANT: Fivetran log tables do NOT contain org_id
// ========================================================
// The views filter by org_id through the data_connections table:
//   - data_connections has org_id and fivetran_connector_id
//   - Views JOIN fivetran_log tables ON fivetran_connector_id = connection_id
//   - This automatically scopes Fivetran data to the querying organization
//
// If Fivetran log connector is not configured, these functions will return
// empty arrays (which is the expected behavior). The UI handles this gracefully.
// =============================================================================

/**
 * Fivetran Connection Overview
 *
 * Simple interface with essential connection info from Fivetran.
 */
export interface FivetranConnectionOverview {
  local_connection_id: string
  org_id: string
  source_type: string
  schema_name: string | null
  fivetran_connector_id: string | null
  connection_name: string | null
  official_connector_name: string | null
  connector_type: string | null
  status: "deleted" | "paused" | "not_configured" | "active"
  paused: boolean | null
  sync_frequency: number | null
  last_successful_sync_at: string | null
  deployment_type: string | null
  destination_name: string | null
  destination_region: string | null
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Fetches Fivetran connection overview for the current organization.
 * Returns basic info: connector, status, last successful sync, identifiers, and sync frequency.
 *
 * @param authToken Optional: JWT token for authenticated Supabase client.
 * @returns A promise that resolves to an array of FivetranConnectionOverview objects.
 */
export async function getFivetranConnectionOverview(
  authToken?: string,
): Promise<FivetranConnectionOverview[]> {
  const supabase = authToken ? createBrowserClient({ authToken }) : createServiceClient()

  const { data, error } = await supabase
    .from("v_fivetran_connection_overview")
    .select("*")
    .order("source_type")

  if (error) {
    logger.error("connect.fivetran.get_connection_overview_failed", {
      error: error.message,
    })
    throw error
  }

  return (data as FivetranConnectionOverview[]) || []
}

/**
 * Fetches a specific Fivetran connection overview by connection ID.
 *
 * @param connectionId The local connection ID to fetch.
 * @param authToken Optional: JWT token for authenticated Supabase client.
 * @returns A promise that resolves to a single FivetranConnectionOverview object or null.
 */
export async function getFivetranConnectionOverviewById(
  connectionId: string,
  authToken?: string,
): Promise<FivetranConnectionOverview | null> {
  const supabase = authToken ? createBrowserClient({ authToken }) : createServiceClient()

  const { data, error } = await supabase
    .from("v_fivetran_connection_overview")
    .select("*")
    .eq("local_connection_id", connectionId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    logger.error("connect.fivetran.get_connection_overview_by_id_failed", {
      error: error.message,
      connectionId,
    })
    throw error
  }

  return data as FivetranConnectionOverview
}

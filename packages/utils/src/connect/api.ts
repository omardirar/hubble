/**
 * Connect API Client Utilities
 *
 * This module provides client-side utilities for interacting with the Connect API.
 * These functions handle authentication and provide a clean interface for the
 * connect feature endpoints.
 */

import { connect } from "@hubble/api-contracts"

export type ConnectStatus = "pending" | "running" | "ready" | "failed" | "not_found"

/**
 * Get the status of a provisioning run
 */
export async function getStatus(correlationId: string): Promise<ConnectStatus> {
  const response = await fetch(
    `/api/connect/status?correlation_id=${encodeURIComponent(correlationId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  )

  if (!response.ok) {
    if (response.status === 404) {
      return "not_found"
    }
    throw new Error(`Failed to get status: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.status as ConnectStatus
}

/**
 * Enable connect (create a new provisioning run)
 * Note: This will redirect the browser to /connect?correlation_id=... due to PRG pattern
 */
export async function enable(): Promise<{ correlationId: string }> {
  const response = await fetch("/api/connect/enable", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    throw new Error(`Failed to enable connect: ${response.status} ${response.statusText}`)
  }

  // For browser requests, this will be a redirect, so we won't reach here
  // For API clients, return the JSON response
  const data = await response.json()
  return { correlationId: data.correlation_id }
}

/**
 * Get the full status response with timeline
 */
export async function getStatusWithTimeline(
  correlationId: string,
): Promise<connect.StatusResponse> {
  const response = await fetch(
    `/api/connect/status?correlation_id=${encodeURIComponent(correlationId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  )

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Run not found")
    }
    throw new Error(`Failed to get status: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

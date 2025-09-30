"use client"

/**
 * React Query hooks for Connect overview data
 *
 * These hooks provide optimized data fetching with automatic caching,
 * background revalidation, and request deduplication for Connect features.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { logger } from "@hubble/logger"

// Types for the overview API response
export interface ConnectOverviewData {
  status: "provisioning" | "ready" | "suspended" | "failed" | null
  isProvisioned: boolean
  lastProvisionedAt: string | null
  destinationId: string | null
  destinationStatus: "pending" | "healthy" | "unhealthy" | null
  fivetranDestinationId: string | null
  mdDbName: string | null
  hasConnections: boolean
  totalConnections: number
  healthyConnections: number
  errorConnections: number
  connections: Array<{
    id: string
    source_type: string
    fivetran_connector_id: string | null
    schema_name: string | null
    status: string
    created_at: string
    updated_at: string
    fivetran_health?: {
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
      last_synced_at: string | null
      deployment_type: string | null
      destination_name: string | null
      destination_region: string | null
    } | null
  }>
  connectors: Array<{
    code: string
    label: string
  }>
  request_id: string
}

/**
 * Hook to fetch Connect overview data
 *
 * This hook fetches all Connect-related data in a single request:
 * - Organization provisioning status
 * - Data connections
 * - Available connector types
 *
 * Features:
 * - Automatic caching (30s fresh, 5min cache)
 * - Background revalidation on window focus
 * - Request deduplication
 * - Retry on failure (2 attempts)
 */
export function useConnectOverview() {
  return useQuery<ConnectOverviewData>({
    queryKey: ["connect", "overview"],
    queryFn: async () => {
      logger.debug("connect.query.overview.fetch_started", {})

      const response = await fetch("/api/connect/overview")

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        logger.error("connect.query.overview.fetch_failed", {
          status: response.status,
          error: errorData,
        })
        throw new Error(errorData?.error?.message || `Failed to fetch overview: ${response.status}`)
      }

      const data = await response.json()

      logger.debug("connect.query.overview.fetch_completed", {
        status: data.status,
        hasConnections: data.hasConnections,
        totalConnections: data.totalConnections,
      })

      return data
    },
    // Data is fresh for 30 seconds
    staleTime: 30 * 1000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Refetch when user returns to tab
    refetchOnWindowFocus: true,
    // Retry twice on failure
    retry: 2,
  })
}

/**
 * Hook to trigger provisioning
 *
 * Features:
 * - Optimistic status update
 * - Automatic cache invalidation on success
 * - Error rollback
 */
export function useEnableConnect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      logger.info("connect.mutation.enable.started", {})

      const response = await fetch("/api/connect/enable", {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        logger.error("connect.mutation.enable.failed", {
          status: response.status,
          error: errorData,
        })
        throw new Error(errorData?.error?.message || "Failed to enable Connect")
      }

      const data = await response.json()

      logger.info("connect.mutation.enable.completed", {
        correlationId: data.correlation_id,
      })

      return data
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["connect", "overview"] })

      // Snapshot the previous value
      const previousOverview = queryClient.getQueryData<ConnectOverviewData>([
        "connect",
        "overview",
      ])

      // Optimistically update to loading state
      queryClient.setQueryData<ConnectOverviewData>(
        ["connect", "overview"],
        (old: ConnectOverviewData | undefined) => {
          if (!old) return old
          return {
            ...old,
            status: "provisioning",
            isProvisioned: false,
          }
        },
      )

      return { previousOverview }
    },
    onError: (
      err: unknown,
      _variables: unknown,
      context: { previousOverview?: ConnectOverviewData } | undefined,
    ) => {
      // Rollback on error
      if (context?.previousOverview) {
        queryClient.setQueryData(["connect", "overview"], context.previousOverview)
      }
      logger.error("connect.mutation.enable.error", {
        error: err instanceof Error ? err.message : String(err),
      })
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["connect", "overview"] })
    },
  })
}

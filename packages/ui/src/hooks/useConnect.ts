"use client"

/**
 * Connect State Management Hook
 *
 * This hook provides a simplified interface for Connect features using React Query
 * for optimized data fetching and caching. It replaces the previous implementation
 * that made multiple API calls with a single, efficient overview endpoint.
 *
 * Features:
 * - Automatic caching and background revalidation
 * - Optimistic updates for better UX
 * - Request deduplication
 * - EventSource streaming for real-time provisioning updates
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { logger } from "@hubble/logger"
import { useConnectOverview, useEnableConnect } from "./queries/use-connect-overview"

export type ConnectState = "idle" | "loading" | "ready" | "error" | "checking"

export interface UseConnectReturn {
  state: ConnectState
  error: string | null
  handleEnable: () => Promise<void>
  // Connection data from React Query
  connections: Array<{
    id: string
    source_type: string
    fivetran_connector_id: string | null
    schema_name: string | null
    status: string
    created_at: string
    updated_at: string
  }>
  connectors: Array<{ code: string; label: string }>
  loadingConnections: boolean
  loadingConnectors: boolean
  refreshConnections: () => Promise<void>
  refreshConnectors: () => Promise<void>
  refreshConnector: (connectorId: string) => Promise<void>
}

export function useConnect(): UseConnectReturn {
  const [state, setState] = useState<ConnectState>("checking")
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Use React Query for data fetching
  const { data: overview, isLoading, error: queryError, refetch } = useConnectOverview()
  const enableMutation = useEnableConnect()

  // Update state based on overview data
  useEffect(() => {
    if (isLoading) {
      setState("checking")
      return
    }

    if (queryError) {
      logger.error("connect.overview.query_error", {
        error: queryError instanceof Error ? queryError.message : String(queryError),
      })
      // Don't set error state for initial load failures - default to idle
      setState("idle")
      return
    }

    if (!overview) {
      setState("idle")
      return
    }

    // Map overview status to UI state
    if (overview.status === "ready") {
      setState("ready")
    } else if (overview.status === "provisioning") {
      setState("loading")
    } else if (overview.status === "failed") {
      setState("error")
      setError("Provisioning failed")
    } else {
      setState("idle")
    }
  }, [overview, isLoading, queryError])

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const handleEnable = useCallback(async () => {
    setState("loading")
    setError(null)

    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      // Trigger the mutation
      const result = await enableMutation.mutateAsync(undefined)

      // Connect to real-time SSE stream
      const eventSource = new EventSource(
        `/api/connect/stream?correlation_id=${result.correlation_id}`,
      )
      eventSourceRef.current = eventSource

      eventSource.addEventListener("end", (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.status === "ready") {
            setState("ready")
            // Refetch overview to get updated data
            refetch()
          } else {
            setState("error")
            setError("Setup failed. Please check the logs for more details.")
          }

          eventSource.close()
          eventSourceRef.current = null
        } catch (err) {
          logger.error("connect.sse.end_parse_error", {
            error: err instanceof Error ? err.message : String(err),
            correlationId: result?.correlation_id || "unknown",
          })
          setState("error")
          setError("Failed to parse response. Please try again.")
        }
      })

      eventSource.onerror = () => {
        setState("error")
        setError("Connection lost. Please refresh to retry.")
        eventSource.close()
        eventSourceRef.current = null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setState("error")
      setError(errorMessage)
    }
  }, [enableMutation, refetch])

  // Refresh connections by refetching overview
  const refreshConnections = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Refresh connectors by refetching overview
  const refreshConnectors = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Refresh a specific connector status
  // Note: This now just refetches the entire overview which includes Fivetran health
  const refreshConnector = useCallback(
    async (connectorId: string) => {
      try {
        logger.info("connect.refresh_connector.triggered", { connectorId })
        await refetch()
      } catch (err) {
        logger.error("connect.refresh_connector.failed", {
          error: err instanceof Error ? err.message : String(err),
          connectorId,
        })
      }
    },
    [refetch],
  )

  return {
    state,
    error,
    handleEnable,
    connections: overview?.connections || [],
    connectors: overview?.connectors || [],
    loadingConnections: isLoading,
    loadingConnectors: isLoading,
    refreshConnections,
    refreshConnectors,
    refreshConnector,
  }
}

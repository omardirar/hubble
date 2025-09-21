"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { logger } from "@hubble/logger"

export type ConnectState = "idle" | "loading" | "ready" | "error" | "checking"

export interface UseConnectReturn {
  state: ConnectState
  error: string | null
  handleEnable: () => Promise<void>
}

export function useConnect(): UseConnectReturn {
  const [state, setState] = useState<ConnectState>("checking")
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Check provisioning status on component mount
  useEffect(() => {
    const checkProvisioningStatus = async () => {
      try {
        const response = await fetch("/api/connect/status-check")

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        if (data.isProvisioned) {
          setState("ready")
        } else {
          setState("idle")
        }
      } catch (error) {
        logger.error("connect.status-check.failed", {
          error: error instanceof Error ? error.message : String(error),
        })
        // If status check fails, default to idle state
        setState("idle")
      }
    }

    checkProvisioningStatus()
  }, [])

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
      const response = await fetch("/api/connect/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Connect to real-time SSE stream
      const eventSource = new EventSource(
        `/api/connect/stream?correlation_id=${data.correlation_id}`,
      )
      eventSourceRef.current = eventSource

      eventSource.addEventListener("end", (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.status === "ready") {
            setState("ready")
          } else {
            setState("error")
            setError("Setup failed. Please check the logs for more details.")
          }

          eventSource.close()
          eventSourceRef.current = null
        } catch (error) {
          logger.error("connect.sse.end_parse_error", {
            error: error instanceof Error ? error.message : String(error),
            correlationId: data.correlation_id,
          })
          setState("error")
          setError("Failed to parse response. Please try again.")
        }
      })

      eventSource.onerror = (_error) => {
        setState("error")
        setError("Connection lost. Please refresh to retry.")
        eventSource.close()
        eventSourceRef.current = null
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setState("error")
      setError(errorMessage)
    }
  }, [])

  return {
    state,
    error,
    handleEnable,
  }
}

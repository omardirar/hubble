"use client"

import { useState, useEffect, useRef } from "react"
import { Button, ErrorBoundary, Spinner } from "@hubble/ui"
import { logger } from "@hubble/logger"

type ConnectState = "idle" | "loading" | "ready" | "error" | "checking"

export default function Page() {
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

  const handleEnable = async () => {
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
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-4">Connect</h1>
            <p className="text-muted-foreground mb-6">
              Set up your data pipeline with MotherDuck and Fivetran integration.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
            {state === "checking" && (
              <div className="flex flex-col items-center space-y-4">
                <Spinner size={32} className="text-primary" />
                <p className="text-muted-foreground">Checking provisioning status...</p>
              </div>
            )}

            {state === "idle" && (
              <Button onClick={handleEnable} size="lg" className="px-8 py-3">
                Enable Connect
              </Button>
            )}

            {state === "loading" && (
              <div className="flex flex-col items-center space-y-4">
                <Spinner size={32} className="text-primary" />
                <p className="text-muted-foreground">Setting up your data pipeline...</p>
              </div>
            )}

            {state === "ready" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold">Connect Setup Complete!</h2>
                <p className="text-muted-foreground">Your data pipeline is ready to use.</p>
                <div className="mt-8 p-6 bg-muted rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Connect Cards (WIP)</h3>
                  <p className="text-sm text-muted-foreground">
                    This section will contain your data source connections and pipeline status.
                  </p>
                </div>
              </div>
            )}

            {state === "error" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold">Setup Failed</h2>
                <p className="text-muted-foreground">{error}</p>
                <Button onClick={handleEnable} variant="outline">
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

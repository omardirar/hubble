"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@hubble/ui"
import { ConnectProgress } from "@hubble/ui"
import { enable, getStatus } from "@hubble/utils/connect/api"
import { connect } from "@hubble/api-contracts"

interface ConnectPageClientProps {
  orgId: string
  correlationId?: string
  initialStatus?: connect.ProvisionRunStatus
  initialEvents?: connect.TimelineEvent[]
}

export function ConnectPageClient({
  orgId,
  correlationId,
  initialStatus,
  initialEvents = [],
}: ConnectPageClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status] = useState<connect.ProvisionRunStatus | null>(initialStatus || null)
  const [events] = useState<connect.TimelineEvent[]>(initialEvents)

  // Check for stored correlation_id on mount if not provided
  useEffect(() => {
    if (!correlationId) {
      const stored = localStorage.getItem(`hubble:connect:correlation_id:${orgId}`)
      if (stored) {
        // Check status of stored correlation_id
        getStatus(stored)
          .then((status) => {
            if (status === "ready") {
              // Clear stored state and redirect to /wip
              localStorage.removeItem(`hubble:connect:correlation_id:${orgId}`)
              router.push("/wip")
            } else if (status === "running" || status === "pending") {
              // Redirect to /connect with correlation_id
              router.push(`/connect?correlation_id=${stored}`)
            } else {
              // Failed or not found - clear stored state
              localStorage.removeItem(`hubble:connect:correlation_id:${orgId}`)
            }
          })
          .catch(() => {
            // Error getting status - clear stored state
            localStorage.removeItem(`hubble:connect:correlation_id:${orgId}`)
          })
      }
    }
  }, [orgId, correlationId, router])

  const handleEnable = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // This will redirect due to PRG pattern, so we won't reach the next line
      await enable()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to enable connect")
      setIsLoading(false)
    }
  }

  // If we have a correlation_id and status is running/pending, show progress
  if (correlationId && (status === "running" || status === "pending")) {
    return <ConnectProgress orgId={orgId} correlationId={correlationId} initialEvents={events} />
  }

  // If we have a correlation_id but status is failed, show error
  if (correlationId && status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] max-w-md mx-auto">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Connection Failed</h1>
          <p className="text-gray-600">The connection setup failed. Please try again.</p>
          <Button onClick={() => router.push("/connect")} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // Show enable button
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] max-w-md mx-auto">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Connect</h1>
          <p className="text-muted-foreground mb-6">
            Set up your data pipeline with MotherDuck and Fivetran integration.
          </p>
        </div>

        <div className="space-y-4">
          <Button onClick={handleEnable} disabled={isLoading} className="min-w-[120px]">
            {isLoading ? "Enabling..." : "Enable"}
          </Button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

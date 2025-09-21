"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Progress } from "@hubble/ui"
import { Button } from "@hubble/ui"
import { subscribeToProvision, getLastEventSeq, clearLastEventSeq } from "@hubble/utils"
import { getProgressState } from "@hubble/utils"
import { connect } from "@hubble/api-contracts"

interface ConnectProgressProps {
  correlationId: string
  orgId: string
  initialEvents?: connect.TimelineEvent[]
}

export function ConnectProgress({
  correlationId,
  orgId,
  initialEvents = [],
}: ConnectProgressProps) {
  const router = useRouter()
  const [events, setEvents] = useState<connect.TimelineEvent[]>(initialEvents)
  const [error, setError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const subscriptionRef = useRef<ReturnType<typeof subscribeToProvision> | null>(null)

  const progressState = getProgressState(events)

  useEffect(() => {
    // Store correlation_id in localStorage for persistence
    localStorage.setItem(`hubble:connect:correlation_id:${orgId}`, correlationId)

    // Get the last seen event sequence for resume
    const lastEventSeq = getLastEventSeq(orgId, correlationId)

    const subscription = subscribeToProvision({
      orgId,
      correlationId,
      lastEventId: lastEventSeq,
      onEvent: (event: any) => {
        setEvents((prev) => {
          // Dedupe by event_seq
          const existing = prev.find((e) => e.event_seq === event.event_seq)
          if (existing) return prev

          return [...prev, event].sort((a, b) => a.event_seq - b.event_seq)
        })
        setError(null) // Clear any previous errors
      },
      onError: (error: any) => {
        console.error("SSE error:", error)
        setError(error.message)
      },
      onEnd: (status: any) => {
        if (status === "ready") {
          // Clear stored state and navigate to /wip
          clearLastEventSeq(orgId, correlationId)
          localStorage.removeItem(`hubble:connect:correlation_id:${orgId}`)
          router.push("/wip")
        } else if (status === "failed" || status === "timeout") {
          setError("Provisioning failed. Please try again.")
        }
      },
    })

    subscriptionRef.current = subscription

    return () => {
      subscription.close()
    }
  }, [orgId, correlationId, router])

  const handleRetry = () => {
    setIsRetrying(true)
    setError(null)
    setEvents([])

    // Clear stored state
    clearLastEventSeq(orgId, correlationId)
    localStorage.removeItem(`hubble:connect:correlation_id:${orgId}`)

    // Navigate back to enable button
    router.push("/connect")
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] max-w-md mx-auto space-y-6">
      <div className="w-full space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Setting up your connection</h2>
          <p className="text-sm text-gray-600 mt-1">{progressState.phase}</p>
        </div>

        <div className="space-y-2">
          <Progress value={progressState.percentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {progressState.completedMilestones} of {progressState.totalMilestones} steps
            </span>
            <span>{Math.round(progressState.percentage)}%</span>
          </div>
        </div>

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
                <h3 className="text-sm font-medium text-red-800">Setup failed</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="text-red-700 border-red-300 hover:bg-red-50"
                  >
                    {isRetrying ? "Retrying..." : "Try again"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

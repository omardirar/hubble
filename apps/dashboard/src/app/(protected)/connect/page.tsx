"use client"

import { useState, useEffect, useRef } from "react"
import { Button, ErrorBoundary } from "@hubble/ui"
import { Terminal, AnimatedSpan, TypingAnimation, StepItem } from "@hubble/ui"
import { logger } from "@hubble/logger"

// Removed unused getStepCommand function

const MAX_TERMINAL_CONTENT = 1000 // Limit terminal content to prevent memory leaks

// Define all possible provisioning steps for progress tracking
const ALL_PROVISIONING_STEPS = [
  "CREATE_SERVICE_ACCOUNT",
  "ISSUE_SA_TOKEN",
  "CREATE_TENANT_DATABASE",
  "CONFIGURE_COMPUTE",
  "CREATE_FIVETRAN_DESTINATION",
  "TEST_DESTINATION",
  "READY",
]

export default function Page() {
  const [isLoading, setIsLoading] = useState(false)
  const [correlationId, setCorrelationId] = useState<string | null>(null)
  const [terminalContent, setTerminalContent] = useState<React.ReactNode[]>([])
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const eventSourceRef = useRef<EventSource | null>(null)

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const handleEnable = async () => {
    setIsLoading(true)
    setTerminalContent([])
    setCorrelationId(null)
    setCompletedSteps(new Set())

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
      setCorrelationId(data.correlation_id)

      // Add initial terminal content with enhanced visuals
      setTerminalContent([
        <div
          key="header"
          className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4"
        >
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="font-medium text-blue-900">Hubble Connect - Provisioning Pipeline</span>
        </div>,
        <AnimatedSpan key="start" delay={0} className="text-green-600 font-mono">
          $ hubble connect enable
        </AnimatedSpan>,
        <TypingAnimation key="starting" delay={1000} duration={80} className="text-gray-600">
          Initializing provisioning process...
        </TypingAnimation>,
        <AnimatedSpan key="correlation" delay={3000} className="text-green-600">
          ✓ Provisioning run created: {data.correlation_id}
        </AnimatedSpan>,
        <AnimatedSpan key="status" delay={4000} className="text-blue-600">
          Status: {data.status}
        </AnimatedSpan>,
        <div key="divider" className="border-t border-gray-200 my-4"></div>,
      ])

      // Connect to real-time SSE stream
      const eventSource = new EventSource(
        `/api/connect/stream?correlation_id=${data.correlation_id}`,
      )
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Update completed steps
          if (data.status === "succeeded" || data.status === "failed") {
            setCompletedSteps((prev) => new Set([...prev, data.step]))
          }

          // Add step item to terminal with enhanced visual representation
          setTerminalContent((prev) => {
            const newContent = [
              ...prev,
              <StepItem
                key={`step-${data.event_seq}`}
                step={data.step}
                status={data.status}
                message={data.message}
                timestamp={data.ts}
                eventSeq={data.event_seq}
                delay={0}
              />,
            ]

            // Keep only the last MAX_TERMINAL_CONTENT items to prevent memory leaks
            return newContent.length > MAX_TERMINAL_CONTENT
              ? newContent.slice(-MAX_TERMINAL_CONTENT)
              : newContent
          })
        } catch (error) {
          logger.error("connect.sse.parse_error", {
            error: error instanceof Error ? error.message : String(error),
            correlationId: data.correlation_id,
          })
        }
      }

      // Note: onmessage already handles update events, so we don't need addEventListener("update")

      eventSource.addEventListener("end", (event) => {
        try {
          const data = JSON.parse(event.data)

          setTerminalContent((prev) => [
            ...prev,
            <AnimatedSpan key="final-status" delay={0}>
              $ hubble connect status
            </AnimatedSpan>,
            <AnimatedSpan key="final-result" delay={500}>
              {data.status === "ready" ? "✓ Connect setup complete!" : "❌ Setup failed"}
            </AnimatedSpan>,
            ...(data.status === "failed" && correlationId
              ? [
                  <AnimatedSpan key="final-correlation" delay={1000}>
                    Run ID: {correlationId}
                  </AnimatedSpan>,
                  <AnimatedSpan key="final-help" delay={1500}>
                    Check logs for detailed error information.
                  </AnimatedSpan>,
                ]
              : []),
          ])

          eventSource.close()
          eventSourceRef.current = null
        } catch (error) {
          logger.error("connect.sse.end_parse_error", {
            error: error instanceof Error ? error.message : String(error),
            correlationId,
          })
        }
      })

      eventSource.onerror = (_error) => {
        setTerminalContent((prev) => [
          ...prev,
          <AnimatedSpan key="sse-error" delay={0}>
            ❌ Connection lost. Please refresh to retry.
          </AnimatedSpan>,
        ])
        eventSource.close()
        eventSourceRef.current = null
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      const correlationInfo = correlationId ? ` (Run ID: ${correlationId})` : ""

      setTerminalContent([
        <AnimatedSpan key="error" delay={0}>
          $ hubble connect enable
        </AnimatedSpan>,
        <AnimatedSpan key="error-message" delay={1000}>
          ❌ Error: {errorMessage}
        </AnimatedSpan>,
        <AnimatedSpan key="error-correlation" delay={2000}>
          {correlationInfo}
        </AnimatedSpan>,
        <AnimatedSpan key="error-help" delay={3000}>
          Please check the logs for more details or try again.
        </AnimatedSpan>,
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">Connect</h1>
            <p className="text-muted-foreground mb-6">
              Set up your data pipeline with MotherDuck and Fivetran integration.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button onClick={handleEnable} disabled={isLoading} className="min-w-[120px]">
                {isLoading ? "Enabling..." : "Enable"}
              </Button>
              {correlationId && (
                <span className="text-sm text-muted-foreground">Run ID: {correlationId}</span>
              )}
            </div>

            {terminalContent.length > 0 && (
              <div className="mt-8">
                <Terminal
                  progress={{
                    completed: completedSteps.size,
                    total: ALL_PROVISIONING_STEPS.length,
                  }}
                >
                  {terminalContent}
                </Terminal>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

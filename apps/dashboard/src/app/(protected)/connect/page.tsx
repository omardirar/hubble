"use client"

import { useState, useEffect, useRef } from "react"
import { Button, ErrorBoundary } from "@hubble/ui"
import { Terminal, AnimatedSpan, TypingAnimation } from "@hubble/ui"

// Map real provisioning steps to terminal commands
function getStepCommand(step: string): string {
  const stepMap: Record<string, string> = {
    CREATE_SERVICE_ACCOUNT: "motherduck create-service-account",
    ISSUE_SA_TOKEN: "motherduck issue-token",
    CREATE_TENANT_DATABASE: "motherduck create-database",
    CONFIGURE_COMPUTE: "motherduck configure-compute",
    CREATE_FIVETRAN_DESTINATION: "fivetran create-destination",
    TEST_DESTINATION: "fivetran test-destination",
  }

  return stepMap[step] || step.toLowerCase().replace(/_/g, "-")
}

const MAX_TERMINAL_CONTENT = 1000 // Limit terminal content to prevent memory leaks

export default function Page() {
  const [isLoading, setIsLoading] = useState(false)
  const [correlationId, setCorrelationId] = useState<string | null>(null)
  const [terminalContent, setTerminalContent] = useState<React.ReactNode[]>([])
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
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setCorrelationId(data.correlation_id)

      // Add initial terminal content
      setTerminalContent([
        <AnimatedSpan key="start" delay={0}>
          $ hubble connect enable
        </AnimatedSpan>,
        <TypingAnimation key="starting" delay={1000} duration={80}>
          Starting provisioning process...
        </TypingAnimation>,
        <AnimatedSpan key="correlation" delay={3000}>
          ✓ Provisioning run created: {data.correlation_id}
        </AnimatedSpan>,
        <AnimatedSpan key="status" delay={4000}>
          Status: {data.status}
        </AnimatedSpan>,
      ])

      // Connect to real-time SSE stream
      const eventSource = new EventSource(
        `/api/connect/stream?correlation_id=${data.correlation_id}`,
      )
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Map real provisioning steps to terminal commands
          const stepCommand = getStepCommand(data.step)

          // Add real provisioning step to terminal with memory cleanup
          setTerminalContent((prev) => {
            const newContent = [
              ...prev,
              <AnimatedSpan key={`step-${data.event_seq}`} delay={0}>
                $ hubble {stepCommand}
              </AnimatedSpan>,
              <TypingAnimation key={`progress-${data.event_seq}`} delay={500} duration={60}>
                {data.message}
              </TypingAnimation>,
              <AnimatedSpan key={`result-${data.event_seq}`} delay={1000}>
                {data.status === "succeeded" ? "✓" : data.status === "failed" ? "❌" : "⏳"}{" "}
                {data.message}
              </AnimatedSpan>,
            ]

            // Keep only the last MAX_TERMINAL_CONTENT items to prevent memory leaks
            return newContent.length > MAX_TERMINAL_CONTENT
              ? newContent.slice(-MAX_TERMINAL_CONTENT)
              : newContent
          })
        } catch (error) {
          console.error("Error parsing SSE data:", error)
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
          ])

          eventSource.close()
          eventSourceRef.current = null
        } catch (error) {
          console.error("Error parsing SSE end:", error)
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
      setTerminalContent([
        <AnimatedSpan key="error" delay={0}>
          $ hubble connect enable
        </AnimatedSpan>,
        <AnimatedSpan key="error-message" delay={1000}>
          ❌ Error: {error instanceof Error ? error.message : "Unknown error"}
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
                <Terminal>{terminalContent}</Terminal>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

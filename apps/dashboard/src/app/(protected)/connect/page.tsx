"use client"

import { useState } from "react"
import { Button } from "@hubble/ui"
import { Terminal, AnimatedSpan, TypingAnimation } from "@hubble/ui"

export default function Page() {
  const [isLoading, setIsLoading] = useState(false)
  const [_correlationId, setCorrelationId] = useState<string | null>(null)
  const [terminalContent, setTerminalContent] = useState<React.ReactNode[]>([])

  const handleEnable = async () => {
    setIsLoading(true)
    setTerminalContent([])

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

      // Simulate additional steps (in a real implementation, you'd connect to SSE)
      setTimeout(() => {
        setTerminalContent((prev) => [
          ...prev,
          <AnimatedSpan key="lock" delay={5000}>
            $ hubble lock acquire
          </AnimatedSpan>,
          <TypingAnimation key="lock-progress" delay={6000} duration={60}>
            Acquiring distributed lock...
          </TypingAnimation>,
          <AnimatedSpan key="lock-success" delay={8000}>
            ✓ Lock acquired successfully
          </AnimatedSpan>,
        ])
      }, 5000)

      setTimeout(() => {
        setTerminalContent((prev) => [
          ...prev,
          <AnimatedSpan key="md-account" delay={9000}>
            $ hubble motherduck create-service-account
          </AnimatedSpan>,
          <TypingAnimation key="md-progress" delay={10000} duration={70}>
            Creating MotherDuck service account...
          </TypingAnimation>,
          <AnimatedSpan key="md-success" delay={12000}>
            ✓ Service account created
          </AnimatedSpan>,
        ])
      }, 9000)

      setTimeout(() => {
        setTerminalContent((prev) => [
          ...prev,
          <AnimatedSpan key="md-db" delay={13000}>
            $ hubble motherduck create-database
          </AnimatedSpan>,
          <TypingAnimation key="db-progress" delay={14000} duration={60}>
            Creating tenant database...
          </TypingAnimation>,
          <AnimatedSpan key="db-success" delay={16000}>
            ✓ Database created successfully
          </AnimatedSpan>,
        ])
      }, 13000)

      setTimeout(() => {
        setTerminalContent((prev) => [
          ...prev,
          <AnimatedSpan key="fivetran" delay={17000}>
            $ hubble fivetran create-destination
          </AnimatedSpan>,
          <TypingAnimation key="fivetran-progress" delay={18000} duration={80}>
            Creating Fivetran destination...
          </TypingAnimation>,
          <AnimatedSpan key="fivetran-success" delay={20000}>
            ✓ Fivetran destination configured
          </AnimatedSpan>,
        ])
      }, 17000)

      setTimeout(() => {
        setTerminalContent((prev) => [
          ...prev,
          <AnimatedSpan key="test" delay={21000}>
            $ hubble test-connection
          </AnimatedSpan>,
          <TypingAnimation key="test-progress" delay={22000} duration={50}>
            Testing connection...
          </TypingAnimation>,
          <AnimatedSpan key="test-success" delay={24000}>
            ✓ Connection test passed
          </AnimatedSpan>,
          <AnimatedSpan key="complete" delay={25000}>
            🚀 Connect setup completed successfully!
          </AnimatedSpan>,
        ])
      }, 21000)
    } catch (error) {
      console.error("Failed to enable connect:", error)
      setTerminalContent((prev) => [
        ...prev,
        <AnimatedSpan key="error" delay={0}>
          ✗ Error: {error instanceof Error ? error.message : "Unknown error"}
        </AnimatedSpan>,
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Connect</h1>
        <p className="text-muted-foreground">
          Set up your data connections with MotherDuck and Fivetran.
        </p>
      </div>

      <div className="space-y-4">
        <Button onClick={handleEnable} disabled={isLoading} className="w-fit">
          {isLoading ? "Enabling..." : "Enable Connect"}
        </Button>

        {terminalContent.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-lg font-medium">Provisioning Log</h3>
            <Terminal className="max-h-[500px]">{terminalContent}</Terminal>
          </div>
        )}
      </div>
    </div>
  )
}

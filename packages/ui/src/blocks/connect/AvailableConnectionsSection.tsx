"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@hubble/ui"
// No direct imports needed - using API calls
import { ConnectCardItem } from "./ConnectCards"
import { logger } from "@hubble/logger"

interface ConnectorType {
  code: string
  label: string
}

// Map connector codes to icon keys
const connectorIconMap: Record<string, keyof typeof import("@hubble/ui").connectCardIcons> = {
  facebook_ads: "facebookAds",
  google_ads: "googleAds",
  tiktok_ads: "tiktokAds",
  linkedin_ads: "linkedinAds",
}

export function AvailableConnectionsSection() {
  const [connectors, setConnectors] = useState<ConnectorType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchConnectors = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/connect/connector-types")
        if (!response.ok) {
          throw new Error(`Failed to fetch connector types: ${response.status}`)
        }
        const result = await response.json()
        const data = result.connector_types || []
        setConnectors(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch connectors"
        logger.error("connect.available_connections.fetch_failed", {
          error: errorMessage,
        })
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchConnectors()
  }, [])

  const handleConnect = async (connectorCode: string) => {
    try {
      logger.info("connect.available_connections.connect_clicked", {
        connector_code: connectorCode,
      })

      // Create Fivetran connector
      const response = await fetch("/api/connect/connector/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_type: connectorCode,
          config: {}, // Empty config for now - will be filled by Fivetran setup
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "Failed to create connector")
      }

      const data = await response.json()

      logger.info("connect.available_connections.connect_card_generated", {
        connection_id: data.connection_id,
        connect_card_url: data.connect_card_url,
      })

      // Redirect to Fivetran Connect Card for setup
      if (data.connect_card_url) {
        // Open in same window for better UX
        window.location.href = data.connect_card_url
      } else {
        throw new Error("No Connect Card URL received")
      }
    } catch (error) {
      logger.error("connect.available_connections.connect_failed", {
        error: error instanceof Error ? error.message : String(error),
        connector_code: connectorCode,
      })

      alert(`Failed to create connector: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Available Connections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading available connectors...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Available Connections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Connections</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {connectors.map((connector) => {
            const iconKey = connectorIconMap[connector.code]
            if (!iconKey) {
              logger.warn("connect.available_connections.unknown_connector", {
                connector_code: connector.code,
              })
              return null
            }

            return (
              <ConnectCardItem
                key={connector.code}
                icon={iconKey}
                name={connector.label}
                onConnect={() => handleConnect(connector.code)}
                isConnected={false}
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

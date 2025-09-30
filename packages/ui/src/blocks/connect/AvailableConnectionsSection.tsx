"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@hubble/ui"
import { useConnectOverview } from "@hubble/ui"
import { ConnectCardItem } from "./ConnectCards"
import { logger } from "@hubble/logger"

interface ConnectorType {
  code: string
  label: string
}

// Map connector codes to icon keys
const connectorIconMap: Record<string, keyof typeof import("@hubble/ui").connectCardIcons> = {
  facebook_ads: "facebook_ads",
  google_ads: "google_ads",
  tiktok_ads: "tiktok_ads",
  linkedin_ads: "linkedin_ads",
}

export function AvailableConnectionsSection() {
  const { data: overview, isLoading: loading, error: queryError } = useConnectOverview()

  const connectors = overview?.connectors || []
  const connections = overview?.connections || []
  const error = queryError instanceof Error ? queryError.message : null

  // Get list of already connected source types
  const connectedSourceTypes = new Set(connections.map((conn) => conn.source_type))

  // Filter out connectors that are already connected
  const availableConnectors = connectors.filter(
    (connector) => !connectedSourceTypes.has(connector.code),
  )

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
        {availableConnectors.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            All available connectors are already connected. Great job! 🎉
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {availableConnectors.map((connector) => {
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
        )}
      </CardContent>
    </Card>
  )
}

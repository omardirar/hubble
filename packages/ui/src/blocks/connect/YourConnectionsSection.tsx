"use client"

import { Card, CardContent, CardHeader, CardTitle, Button, connectCardIcons } from "@hubble/ui"
import { useConnectOverview } from "@hubble/ui"
import { logger } from "@hubble/logger"
import { RefreshCw, Edit } from "lucide-react"
import type { FivetranConnectionOverview } from "@hubble/connect"

interface DataConnection {
  id: string
  source_type: string
  fivetran_connector_id: string | null
  schema_name: string | null
  status: string
  created_at: string
  updated_at: string
  fivetran_health?: FivetranConnectionOverview | null
}

// Map connector source types to icon keys
const connectorIconMap: Record<string, keyof typeof connectCardIcons> = {
  facebook_ads: "facebook_ads",
  google_ads: "google_ads",
  tiktok_ads: "tiktok_ads",
  linkedin_ads: "linkedin_ads",
}

export function YourConnectionsSection() {
  const { data: overview, isLoading: loading, error: queryError, refetch } = useConnectOverview()

  const connections = overview?.connections || []
  const error = queryError instanceof Error ? queryError.message : null

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Connections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading your connections...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Connections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    )
  }

  const handleRefresh = async () => {
    await refetch()
  }

  const handleEdit = async (connection: DataConnection) => {
    try {
      logger.info("connect.your_connections.edit_clicked", {
        connectionId: connection.id,
        sourceType: connection.source_type,
      })

      if (!connection.fivetran_connector_id) {
        logger.warn("connect.your_connections.edit_no_connector_id", {
          connectionId: connection.id,
        })
        alert("This connection is not yet configured. Please wait for setup to complete.")
        return
      }

      // Call API to generate Connect Card URL
      const response = await fetch("/api/connect/connector/connect-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection_id: connection.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "Failed to generate Connect Card URL")
      }

      const data = await response.json()

      logger.info("connect.your_connections.connect_card_generated", {
        connectionId: connection.id,
        connectCardUrl: data.connect_card_url,
      })

      // Redirect to Fivetran Connect Card for editing
      if (data.connect_card_url) {
        window.location.href = data.connect_card_url
      } else {
        throw new Error("No Connect Card URL received")
      }
    } catch (err) {
      logger.error("connect.your_connections.edit_failed", {
        error: err instanceof Error ? err.message : String(err),
        connectionId: connection.id,
      })

      alert(`Failed to open connector editor: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600"
      case "paused":
        return "text-yellow-600"
      case "deleted":
        return "text-red-600"
      case "not_configured":
        return "text-muted-foreground"
      default:
        return "text-muted-foreground"
    }
  }

  const getStatusLabel = (status: string) => {
    return status.replace("_", " ").toUpperCase()
  }

  const formatSyncFrequency = (minutes: number | null) => {
    if (!minutes) return "Not set"
    const hours = Math.floor(minutes / 60)
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      return `Every ${days} day${days > 1 ? "s" : ""}`
    }
    if (hours >= 1) {
      return `Every ${hours} hour${hours > 1 ? "s" : ""}`
    }
    return `Every ${minutes} min${minutes > 1 ? "s" : ""}`
  }

  const formatLastSynced = (lastSyncedAt: string | null) => {
    if (!lastSyncedAt) return "Never"
    const syncedAt = new Date(lastSyncedAt)
    const now = Date.now()
    const diffMs = now - syncedAt.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Your Connections</CardTitle>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No connections yet. Connect to a data source below to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => {
              const health = connection.fivetran_health
              const displayStatus = health?.status || connection.status
              const displayName =
                health?.official_connector_name || connection.source_type.replace("_", " ")
              const iconKey = connectorIconMap[connection.source_type]
              const iconData = iconKey ? connectCardIcons[iconKey] : null

              return (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg">
                      {iconData ? <img src={iconData.icon} alt={iconData.alt} /> : <div />}
                    </div>

                    {/* Connection Info */}
                    <div className="space-y-1">
                      {/* Name */}
                      <div className="font-medium capitalize">{displayName}</div>

                      {/* Status, Last Synced, Sync Frequency */}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {/* Status */}
                        <span className={`font-medium ${getStatusColor(displayStatus)}`}>
                          {getStatusLabel(displayStatus)}
                        </span>

                        <span className="text-muted-foreground/50">•</span>

                        {/* Last Synced */}
                        <span>
                          {health?.last_synced_at
                            ? `Synced ${formatLastSynced(health.last_synced_at)}`
                            : "Not synced"}
                        </span>

                        <span className="text-muted-foreground/50">•</span>

                        {/* Sync Frequency */}
                        <span>{formatSyncFrequency(health?.sync_frequency || null)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Edit Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(connection)}
                    disabled={!connection.fivetran_connector_id}
                    title={
                      connection.fivetran_connector_id
                        ? "Edit connector configuration"
                        : "Connector not ready"
                    }
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, Button } from "@hubble/ui"
// No direct imports needed - using API calls
import { useAuth } from "@clerk/nextjs"
import { logger } from "@hubble/logger"
import { RefreshCw, Edit, Settings } from "lucide-react"

interface DataConnection {
  id: string
  source_type: string
  fivetran_connector_id: string | null
  schema_name: string | null
  status: string
  created_at: string
  updated_at: string
}

export function YourConnectionsSection() {
  const [connections, setConnections] = useState<DataConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { getToken, orgId } = useAuth()

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = await getToken()
        if (!token) {
          throw new Error("No authentication token available")
        }

        if (!orgId) {
          throw new Error("No organization ID found")
        }

        const response = await fetch("/api/connect/connections", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch connections: ${response.status}`)
        }
        const result = await response.json()
        const data = result.connections || []
        setConnections(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch connections"
        logger.error("connect.your_connections.fetch_failed", {
          error: errorMessage,
        })
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchConnections()
  }, [getToken, orgId])

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
    try {
      setLoading(true)
      setError(null)

      const token = await getToken()
      if (!token) {
        throw new Error("No authentication token available")
      }

      if (!orgId) {
        throw new Error("No organization ID found")
      }

      const response = await fetch("/api/connect/connections", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch connections: ${response.status}`)
      }
      const result = await response.json()
      const data = result.connections || []
      setConnections(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch connections"
      logger.error("connect.your_connections.refresh_failed", {
        error: errorMessage,
      })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (connection: DataConnection) => {
    try {
      // For now, we'll redirect to Fivetran's connector configuration page
      // In the future, this could open a modal or dedicated edit page
      if (connection.fivetran_connector_id) {
        // Open Fivetran connector configuration in a new tab
        const fivetranUrl = `https://fivetran.com/dashboard/connectors/${connection.fivetran_connector_id}/setup`
        window.open(fivetranUrl, "_blank")
      } else {
        logger.warn("connect.your_connections.edit_no_connector_id", {
          connectionId: connection.id,
        })
        // Could show a toast or modal here
      }
    } catch (err) {
      logger.error("connect.your_connections.edit_failed", {
        error: err instanceof Error ? err.message : String(err),
        connectionId: connection.id,
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600"
      case "error":
        return "text-red-600"
      case "syncing":
        return "text-blue-600"
      case "paused":
        return "text-yellow-600"
      case "needs_auth":
        return "text-orange-600"
      default:
        return "text-muted-foreground"
    }
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
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-muted" />
                  <div>
                    <div className="font-medium capitalize">
                      {connection.source_type.replace("_", " ")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Schema: {connection.schema_name || "Not set"}
                    </div>
                    {connection.fivetran_connector_id && (
                      <div className="text-xs text-muted-foreground">
                        Connector: {connection.fivetran_connector_id}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getStatusColor(connection.status)}`}>
                      {connection.status.replace("_", " ").toUpperCase()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(connection.created_at).toLocaleDateString()}
                    </div>
                  </div>
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

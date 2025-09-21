/**
 * SSE Client for Provisioning Status
 *
 * This module provides a robust SSE client for subscribing to provisioning
 * status updates with resume capability, deduping, and error handling.
 */

import { connect } from "@hubble/api-contracts"

export interface ProvisionEvent {
  correlation_id: string
  step: connect.ProvisionStep
  status: connect.ProvisionEventStatus
  event_seq: number
  ts: string
  message?: string
}

export interface ProvisionEventHandlers {
  onEvent: (event: ProvisionEvent) => void
  onError: (error: Error) => void
  onEnd?: (status: "ready" | "failed" | "timeout") => void
}

export interface ProvisionSubscription {
  close: () => void
}

/**
 * Subscribe to provisioning events via SSE with resume capability
 */
export function subscribeToProvision({
  orgId,
  correlationId,
  onEvent,
  onError,
  onEnd,
  lastEventId,
}: {
  orgId: string
  correlationId: string
  onEvent: (event: ProvisionEvent) => void
  onError: (error: Error) => void
  onEnd?: (status: "ready" | "failed" | "timeout") => void
  lastEventId?: number
}): ProvisionSubscription {
  let eventSource: EventSource | null = null
  let lastSeenEventSeq = lastEventId || 0
  let isClosed = false
  let reconnectTimeout: NodeJS.Timeout | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000 // 1 second

  const getReconnectDelay = (attempt: number): number => {
    return Math.min(baseReconnectDelay * Math.pow(2, attempt), 30000) // Max 30 seconds
  }

  const connect = () => {
    if (isClosed) return

    const url = new URL("/api/connect/stream", window.location.origin)
    url.searchParams.set("correlation_id", correlationId)

    eventSource = new EventSource(url.toString())

    // Store last seen event_seq in sessionStorage for resume
    const sessionKey = `hubble:connect:last_event_seq:${orgId}:${correlationId}`
    sessionStorage.setItem(sessionKey, lastSeenEventSeq.toString())

    eventSource.onopen = () => {
      reconnectAttempts = 0
    }

    eventSource.onmessage = (event) => {
      try {
        // Handle heartbeats (lines starting with :)
        if (event.data.startsWith(":")) {
          return
        }

        const data = JSON.parse(event.data) as ProvisionEvent

        // Dedupe by event_seq
        if (data.event_seq <= lastSeenEventSeq) {
          return
        }

        lastSeenEventSeq = data.event_seq
        sessionStorage.setItem(sessionKey, lastSeenEventSeq.toString())

        onEvent(data)
      } catch (error) {
        onError(
          new Error(
            `Failed to parse SSE event: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
      }
    }

    eventSource.addEventListener("update", (event) => {
      try {
        const data = JSON.parse(event.data) as ProvisionEvent

        // Dedupe by event_seq
        if (data.event_seq <= lastSeenEventSeq) {
          return
        }

        lastSeenEventSeq = data.event_seq
        sessionStorage.setItem(sessionKey, lastSeenEventSeq.toString())

        onEvent(data)
      } catch (error) {
        onError(
          new Error(
            `Failed to parse SSE update event: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
      }
    })

    eventSource.addEventListener("end", (event) => {
      try {
        const data = JSON.parse(event.data) as { status: "ready" | "failed" | "timeout" }
        onEnd?.(data.status)
        close()
      } catch (error) {
        onError(
          new Error(
            `Failed to parse SSE end event: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
        close()
      }
    })

    eventSource.onerror = (error) => {
      if (isClosed) return

      // Close the current connection
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }

      // Attempt to reconnect if we haven't exceeded max attempts
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        const delay = getReconnectDelay(reconnectAttempts - 1)

        reconnectTimeout = setTimeout(() => {
          if (!isClosed) {
            connect()
          }
        }, delay)

        onError(
          new Error(
            `Connection lost, attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
          ),
        )
      } else {
        onError(new Error("Connection failed after maximum reconnect attempts"))
        onEnd?.("failed")
        close()
      }
    }
  }

  const close = () => {
    isClosed = true

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  // Start the connection
  connect()

  return { close }
}

/**
 * Get the last seen event sequence for a correlation ID from sessionStorage
 */
export function getLastEventSeq(orgId: string, correlationId: string): number | undefined {
  const sessionKey = `hubble:connect:last_event_seq:${orgId}:${correlationId}`
  const stored = sessionStorage.getItem(sessionKey)
  return stored ? parseInt(stored, 10) : undefined
}

/**
 * Clear the stored event sequence for a correlation ID
 */
export function clearLastEventSeq(orgId: string, correlationId: string): void {
  const sessionKey = `hubble:connect:last_event_seq:${orgId}:${correlationId}`
  sessionStorage.removeItem(sessionKey)
}

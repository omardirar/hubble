import { connect } from "@hubble/schemas"
import { getStatus, RunNotFoundError } from "./db"

export type StreamLogger = {
  info: (message: string, meta?: Record<string, unknown>) => void
  warn: (message: string, meta?: Record<string, unknown>) => void
  error: (message: string, meta?: Record<string, unknown>) => void
}

/**
 * Create a server-sent events response that streams provisioning timeline updates
 * for the given organization + correlation id.
 */
export async function createConnectStatusStream(
  orgId: string,
  correlationId: string,
  logger: StreamLogger,
  authToken?: string,
): Promise<Response> {
  let initialStatus: connect.StatusResponse
  let retries = 0
  const maxRetries = 3

  while (retries < maxRetries) {
    try {
      logger.info("connect.stream.fetching_initial_status", {
        correlation_id: correlationId,
        org_id: orgId,
        retry: retries,
      })
      initialStatus = await getStatus(orgId, correlationId, undefined, true, authToken)
      logger.info("connect.stream.initial_status_success", {
        correlation_id: correlationId,
        org_id: orgId,
        status: initialStatus.status,
        timeline_length: initialStatus.timeline.length,
      })
      break
    } catch (error) {
      retries++
      logger.warn("connect.stream.initial_status_attempt_failed", {
        error: error instanceof Error ? error.message : String(error),
        errorDetails:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
        correlation_id: correlationId,
        org_id: orgId,
        retry: retries,
        maxRetries,
      })

      if (retries >= maxRetries) {
        logger.error("connect.stream.initial_status_failed", {
          error: error instanceof Error ? error.message : String(error),
          errorDetails:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : error,
          correlation_id: correlationId,
          org_id: orgId,
          retries,
        })
        throw error
      }

      // Wait a bit before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * retries))
    }
  }

  let cleanup: () => void = () => {}
  const CONNECTION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
  const MAX_TERMINAL_CONTENT = 1000 // Limit terminal content to prevent memory leaks

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      let lastSeq = 0
      let closed = false
      let heartbeatId: ReturnType<typeof setInterval> | null = null
      let pollerId: ReturnType<typeof setInterval> | null = null
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      const heartbeat = () => {
        if (closed) return
        controller.enqueue(encoder.encode(`:\n\n`))
      }

      const closeStream = () => {
        if (closed) return
        closed = true
        if (heartbeatId) clearInterval(heartbeatId)
        if (pollerId) clearInterval(pollerId)
        if (timeoutId) clearTimeout(timeoutId)
        controller.close()
      }

      cleanup = closeStream

      const emitEvents = (status: connect.StatusResponse) => {
        if (closed) return

        // Debug logging to see what status we're getting
        logger.info("connect.stream.status_update", {
          correlation_id: correlationId,
          status: status.status,
          timeline_length: status.timeline.length,
        })

        // Use atomic operations to prevent race conditions
        const currentLastSeq = lastSeq
        const newItems = status.timeline.filter((event) => event.event_seq > currentLastSeq)

        // Update lastSeq atomically after filtering
        if (newItems.length > 0) {
          lastSeq = Math.max(currentLastSeq, ...newItems.map((item) => item.event_seq))
        }

        for (const item of newItems) {
          if (closed) return // Check again before each emit
          controller.enqueue(encoder.encode(`id: ${item.event_seq}\n`))
          controller.enqueue(encoder.encode(`event: update\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`))
        }

        if (status.status === "ready" || status.status === "failed") {
          if (closed) return // Final check before ending
          logger.info("connect.stream.ending", {
            correlation_id: correlationId,
            status: status.status,
            reason: "final_status_reached",
          })
          controller.enqueue(encoder.encode(`event: end\n`))
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: status.status })}\n\n`),
          )
          closeStream()
        }
      }

      let consecutiveErrors = 0
      const maxConsecutiveErrors = 5

      const poll = async () => {
        if (closed) return

        try {
          const latest = await getStatus(orgId, correlationId, lastSeq, true, authToken)
          emitEvents(latest)
          consecutiveErrors = 0 // Reset error counter on success
        } catch (error) {
          consecutiveErrors++

          if (error instanceof RunNotFoundError) {
            logger.warn("connect.stream.run_not_found", {
              correlation_id: correlationId,
            })
            if (!closed) {
              controller.enqueue(encoder.encode(`event: end\n`))
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ status: "failed", reason: "not_found" })}\n\n`,
                ),
              )
            }
            closeStream()
            return
          }

          logger.error("connect.stream.poll_failed", {
            error: error instanceof Error ? error.message : String(error),
            correlation_id: correlationId,
            consecutive_errors: consecutiveErrors,
            max_consecutive_errors: maxConsecutiveErrors,
          })

          // Close stream after too many consecutive errors
          if (consecutiveErrors >= maxConsecutiveErrors) {
            logger.error("connect.stream.max_errors_reached", {
              correlation_id: correlationId,
              consecutive_errors: consecutiveErrors,
            })
            if (!closed) {
              controller.enqueue(encoder.encode(`event: end\n`))
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ status: "failed", reason: "polling_errors" })}\n\n`,
                ),
              )
            }
            closeStream()
          }
        }
      }

      controller.enqueue(encoder.encode(`retry: 5000\n\n`))
      heartbeatId = setInterval(heartbeat, 25_000)

      // Set connection timeout
      timeoutId = setTimeout(() => {
        logger.warn("connect.stream.connection_timeout", {
          correlation_id: correlationId,
          org_id: orgId,
          timeout_ms: CONNECTION_TIMEOUT_MS,
        })
        if (!closed) {
          controller.enqueue(encoder.encode(`event: end\n`))
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: "timeout", reason: "connection_timeout" })}\n\n`,
            ),
          )
        }
        closeStream()
      }, CONNECTION_TIMEOUT_MS)

      emitEvents(initialStatus)
      if (closed) {
        return
      }

      pollerId = setInterval(() => {
        void poll()
      }, 3000)
      void poll()
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

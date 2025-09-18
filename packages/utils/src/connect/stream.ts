import { connect } from "@hubble/api-contracts"
import { getStatus, RunNotFoundError } from "./db"

export type StreamLogger = {
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
): Promise<Response> {
  const initialStatus = await getStatus(orgId, correlationId)
  let cleanup: () => void = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      let lastSeq = 0
      let closed = false
      let heartbeatId: ReturnType<typeof setInterval> | null = null
      let pollerId: ReturnType<typeof setInterval> | null = null

      const heartbeat = () => {
        if (closed) return
        controller.enqueue(encoder.encode(`:\n\n`))
      }

      const closeStream = () => {
        if (closed) return
        closed = true
        if (heartbeatId) clearInterval(heartbeatId)
        if (pollerId) clearInterval(pollerId)
        controller.close()
      }

      cleanup = closeStream

      const emitEvents = (status: connect.StatusResponse) => {
        if (closed) return
        const newItems = status.timeline.filter((event) => event.event_seq > lastSeq)
        for (const item of newItems) {
          controller.enqueue(encoder.encode(`id: ${item.event_seq}\n`))
          controller.enqueue(encoder.encode(`event: update\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`))
          lastSeq = Math.max(lastSeq, item.event_seq)
        }

        if (status.status === "ready" || status.status === "failed") {
          controller.enqueue(encoder.encode(`event: end\n`))
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: status.status })}\n\n`),
          )
          closeStream()
        }
      }

      const poll = async () => {
        try {
          const latest = await getStatus(orgId, correlationId, lastSeq)
          emitEvents(latest)
        } catch (error) {
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
          })
        }
      }

      controller.enqueue(encoder.encode(`retry: 5000\n\n`))
      heartbeatId = setInterval(heartbeat, 25_000)

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

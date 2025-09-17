import { subscribe } from "@hubble/utils/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs" // Node runtime + Fluid compute configured in vercel.json

export async function GET(request: Request) {
  const url = new URL(request.url)
  const correlation_id = url.searchParams.get("correlation_id")
  const reqId = crypto.randomUUID()
  if (!correlation_id) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION_ERROR", message: "correlation_id is required" },
        request_id: reqId,
      },
      { status: 400 },
    )
  }

  const channel = `provision:events:${correlation_id}`

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const heartbeat = () => controller.enqueue(encoder.encode(`:\n\n`))
      controller.enqueue(encoder.encode(`retry: 5000\n\n`))

      const sub = subscribe(channel, (message: string) => {
        controller.enqueue(encoder.encode(`event: update\n`))
        controller.enqueue(encoder.encode(`data: ${message}\n\n`))
      })

      const heartbeatId = setInterval(heartbeat, 25000)
      try {
        await sub
      } finally {
        clearInterval(heartbeatId)
      }
    },
    cancel() {},
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

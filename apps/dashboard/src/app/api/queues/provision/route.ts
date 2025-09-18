import { NextResponse } from "next/server"
import {
  LockNotAcquiredError,
  LockServiceUnavailableError,
  processProvisionJob,
  ProvisionJobFailedError,
  withQStashVerification,
} from "@hubble/utils/server"

export const runtime = "nodejs"

const handler = async (request: Request) => {
  const { org_id, correlation_id } = (await request.json().catch(() => ({}))) as {
    org_id?: string
    correlation_id?: string
  }

  if (!org_id || !correlation_id) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 })
  }

  try {
    await processProvisionJob({ orgId: org_id, correlationId: correlation_id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof LockNotAcquiredError) {
      return new Response("lock-not-acquired", { status: 409 })
    }
    if (error instanceof LockServiceUnavailableError) {
      return new Response("lock-unavailable", { status: 503 })
    }
    if (error instanceof ProvisionJobFailedError) {
      return new Response("failed", { status: 502 })
    }
    throw error
  }
}

export const POST = withQStashVerification(handler, {
  skipVerification: process.env.NODE_ENV !== "production",
})

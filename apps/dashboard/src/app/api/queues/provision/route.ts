import { NextResponse } from "next/server"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import {
  LockNotAcquiredError,
  processProvisionJob,
  ProvisionJobFailedError,
} from "@hubble/utils/server"
import { getConnectEnv } from "@hubble/env"

export const runtime = "nodejs"

const { QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY } = getConnectEnv()

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
    if (error instanceof ProvisionJobFailedError) {
      return new Response("failed", { status: 502 })
    }
    throw error
  }
}

export const POST = verifySignatureAppRouter(handler, {
  currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
})

import { NextResponse } from "next/server"
import { createServiceClient } from "@hubble/db"
import { acquireLock, releaseLock, publishEvent } from "@hubble/utils/server"
import { appendEvent, updateProvisionRun, upsertTenantDestination } from "@hubble/utils/server"
import { mdCreateServiceAccount, mdIssueToken, mdCreateDatabase } from "@hubble/utils/server"
import { fivetranUpsertMotherDuckDestination, fivetranTestDestination } from "@hubble/utils/server"
import { getConnectEnv } from "@hubble/env"

export const runtime = "nodejs"

// Verify Upstash QStash signature (current or next signing key)
function verifyQStashSignature(req: Request): boolean {
  const sig = req.headers.get("Upstash-Signature") || ""
  const { QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY } = getConnectEnv()
  // Minimal verification stub: in production, use @upstash/qstash/nextjs receiver verification
  return Boolean(
    sig &&
      (sig.includes(QSTASH_CURRENT_SIGNING_KEY.slice(0, 6)) ||
        sig.includes(QSTASH_NEXT_SIGNING_KEY.slice(0, 6))),
  )
}

export async function POST(request: Request) {
  if (!verifyQStashSignature(request)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  const db = createServiceClient()
  const { org_id, correlation_id } = (await request.json().catch(() => ({}))) as {
    org_id?: string
    correlation_id?: string
  }
  if (!org_id || !correlation_id) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 })
  }

  const lockKey = `provision:org:${org_id}`
  const lockTtlMs = 60_000
  const channel = `provision:events:${correlation_id}`

  // Acquire lock to serialize by org
  const acquired = await acquireLock(lockKey, lockTtlMs)
  if (!acquired) {
    // Return non-2xx to trigger QStash retry
    return new Response("lock-not-acquired", { status: 409 })
  }

  // Helper to log DB + publish SSE update
  const logStep = async (
    step: string,
    status: "started" | "succeeded" | "failed",
    message?: string,
    extra?: Record<string, unknown>,
  ) => {
    const { event_seq, ts } = await appendEvent(org_id, correlation_id, step, status, message)
    await publishEvent(channel, {
      correlation_id,
      step,
      status,
      event_seq,
      ts,
      message,
      ...(extra ?? {}),
    })
  }

  try {
    await updateProvisionRun(correlation_id, { status: "running" })

    const mdDbName = `md_${org_id}`
    const mdSaUsername = `sa_${org_id}`

    // 1) CREATE_SERVICE_ACCOUNT
    await logStep("CREATE_SERVICE_ACCOUNT", "started")
    await mdCreateServiceAccount(mdSaUsername)
    await logStep("CREATE_SERVICE_ACCOUNT", "succeeded")

    // 2) ISSUE_SA_TOKEN → store in Vault
    await logStep("ISSUE_SA_TOKEN", "started")
    const { token } = await mdIssueToken(mdSaUsername)
    // Use Supabase Vault via SQL: insert/update secret
    try {
      await db.rpc("vault_set", { p_name: `md_sa_token:${org_id}`, p_secret: token })
    } catch {
      // Fallback if helper not present: try writing to vault.secrets table if available
      await db
        .from("vault.secrets" as never)
        .upsert({ name: `md_sa_token:${org_id}`, secret: token } as never)
    }
    await logStep("ISSUE_SA_TOKEN", "succeeded")

    // 3) CREATE_TENANT_DATABASE
    await logStep("CREATE_TENANT_DATABASE", "started")
    const saToken = token // present in scope; would fetch via vault_md_sa_token(org_id) in a fresh step
    await mdCreateDatabase(mdDbName, saToken)
    await logStep("CREATE_TENANT_DATABASE", "succeeded")

    // 4) CONFIGURE_COMPUTE (optional, no-op)
    await logStep("CONFIGURE_COMPUTE", "succeeded", "skipped/not-required")

    // 5) CREATE_FIVETRAN_DESTINATION (uses server-only token securely)
    await logStep("CREATE_FIVETRAN_DESTINATION", "started")
    const { destination_id } = await fivetranUpsertMotherDuckDestination(
      `org:${org_id}`,
      mdDbName,
      `md_sa_token:${org_id}`,
    )
    await logStep("CREATE_FIVETRAN_DESTINATION", "succeeded", undefined, {
      fivetran_destination_id: destination_id,
    })

    // 6) TEST_DESTINATION
    await logStep("TEST_DESTINATION", "started")
    // Poll with simple backoff
    let ok = false
    for (let i = 0; i < 6; i++) {
      ok = await fivetranTestDestination(destination_id)
      if (ok) break
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
    }
    if (!ok) throw new Error("Destination test timeout")
    await logStep("TEST_DESTINATION", "succeeded")

    // 7) READY: upsert tenant_destinations and mark run ready
    await upsertTenantDestination(org_id, mdDbName, mdSaUsername, destination_id)
    await updateProvisionRun(correlation_id, {
      status: "ready",
      md_db_name: mdDbName,
      md_sa_username: mdSaUsername,
      fivetran_destination_id: destination_id,
      finished_at: new Date().toISOString(),
    })
    await logStep("READY", "succeeded")

    return NextResponse.json({ ok: true })
  } catch (e) {
    await appendEvent(org_id, correlation_id, "ERROR", "failed", String(e))
    await updateProvisionRun(correlation_id, {
      status: "failed",
      finished_at: new Date().toISOString(),
    })
    // Return retriable status
    return new Response("failed", { status: 502 })
  } finally {
    await releaseLock(lockKey)
  }
}

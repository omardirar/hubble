import { createServiceClient } from "@hubble/db"
import { logger } from "../logger"

type Log = ReturnType<typeof logger.child>

export async function insertProvisionRun(orgId: string): Promise<{ correlation_id: string }> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("provisioning_runs")
    .insert({ org_id: orgId, status: "pending" })
    .select("correlation_id")
    .single()
  if (error) throw error
  return { correlation_id: data.correlation_id as string }
}

export async function updateProvisionRun(
  correlationId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from("provisioning_runs")
    .update(updates)
    .eq("correlation_id", correlationId)
  if (error) throw error
}

export async function appendEvent(
  orgId: string,
  correlationId: string,
  step: string,
  status: "started" | "succeeded" | "failed",
  message?: string,
): Promise<{ event_seq: number; ts: string }> {
  const db = createServiceClient()
  // event_seq is bigserial with unique index per correlation; rely on DB monotonicity
  const payload = { step, status, message }
  const { data, error } = await db
    .from("events")
    .insert({
      org_id: orgId,
      provider: "system",
      type: `provision.${step.toLowerCase()}.${status}`,
      correlation_id: correlationId,
      payload,
    })
    .select("event_seq, created_at")
    .single()
  if (error) throw error
  return { event_seq: data.event_seq as number, ts: data.created_at as string }
}

export async function getStatus(orgId: string, correlationId: string) {
  const db = createServiceClient()
  const [{ data: run }, { data: events }] = await Promise.all([
    db
      .from("provisioning_runs")
      .select("status, md_db_name, fivetran_destination_id")
      .eq("correlation_id", correlationId)
      .eq("org_id", orgId)
      .single(),
    db
      .from("events")
      .select("event_seq, payload, created_at")
      .eq("org_id", orgId)
      .eq("correlation_id", correlationId)
      .order("event_seq", { ascending: true }),
  ])
  if (!run) throw new Error("run not found")
  const timeline = (events ?? []).map((e) => ({
    event_seq: e.event_seq as number,
    step: (e.payload as any)?.step ?? "",
    status: (e.payload as any)?.status ?? "",
    message: (e.payload as any)?.message,
    ts: e.created_at as string,
  }))
  return {
    status: run.status as string,
    md_db_name: run.md_db_name as string | undefined,
    fivetran_destination_id: run.fivetran_destination_id as string | undefined,
    timeline,
  }
}

export async function upsertTenantDestination(
  orgId: string,
  mdDbName: string,
  mdSaUsername: string,
  fivetranDestinationId: string,
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db.from("tenant_destinations").upsert(
    {
      org_id: orgId,
      md_db_name: mdDbName,
      md_token_ref: `md_sa_token:${orgId}`,
      fivetran_destination_id: fivetranDestinationId,
      status: "healthy",
      last_event_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  )
  if (error) throw error
}

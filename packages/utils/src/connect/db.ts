import { createServiceClient } from "@hubble/db"
import { connect } from "@hubble/api-contracts"

// Shared schemas ensure DB accessors stay aligned with API contracts at compile/runtime.
const { TimelineEventSchema, StatusResponseSchema } = connect

type TimelineEvent = connect.TimelineEvent
type ProvisionStep = connect.ProvisionStep
type ProvisionEventStatus = connect.ProvisionEventStatus
type StatusResponse = connect.StatusResponse

// Dedicated error allows API handlers to differentiate missing runs from real failures.
export class RunNotFoundError extends Error {
  constructor(correlationId: string) {
    super(`Provisioning run ${correlationId} not found`)
    this.name = "RunNotFoundError"
  }
}

export class TenantNotFoundError extends Error {
  constructor(orgId: string) {
    super(`Tenant ${orgId} not found`)
    this.name = "TenantNotFoundError"
  }
}

export class TenantCreationError extends Error {
  constructor(orgId: string, message: string) {
    super(`Failed to create tenant for organization ${orgId}: ${message}`)
    this.name = "TenantCreationError"
  }
}

export async function insertProvisionRun(orgId: string): Promise<{ correlation_id: string }> {
  const db = createServiceClient()
  // Ensure tenant row exists (syncs from Clerk FDW when available)
  const ensureResult = await db.rpc("ensure_tenant_exists", { p_org_id: orgId })
  if (ensureResult.error) {
    const errorCode = (ensureResult.error as any)?.code
    if (errorCode === "P0001") {
      throw new TenantNotFoundError(orgId)
    }
    if (errorCode === "P0002") {
      throw new TenantCreationError(orgId, ensureResult.error.message)
    }
    throw new Error(`Tenant creation failed: ${ensureResult.error.message}`)
  }
  // Provisioning runs start in "pending"; returning correlation id ties subsequent steps together.
  const { data, error } = await db
    .from("provisioning_runs")
    .insert({ org_id: orgId, status: "pending" })
    .select("correlation_id")
    .single()
  if (error) {
    if ((error as { code?: string }).code === "23503") {
      throw new TenantNotFoundError(orgId)
    }
    throw error
  }
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
  step: ProvisionStep,
  status: ProvisionEventStatus,
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

export async function getStatus(orgId: string, correlationId: string): Promise<StatusResponse> {
  const db = createServiceClient()
  // Fetch run metadata and timeline concurrently for minimal round-trips.
  const [runResult, eventsResult] = await Promise.all([
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

  if (runResult.error) {
    if ((runResult.error as any)?.code === "PGRST116") {
      throw new RunNotFoundError(correlationId)
    }
    throw runResult.error
  }

  if (!runResult.data) {
    throw new RunNotFoundError(correlationId)
  }

  if (eventsResult.error) {
    throw eventsResult.error
  }

  const timeline: TimelineEvent[] = []
  // Validate each stored payload so downstream consumers never see malformed timeline items.
  for (const event of eventsResult.data ?? []) {
    const payload = (event.payload ?? {}) as Record<string, unknown>
    const candidate = {
      event_seq: Number(event.event_seq),
      step: payload.step,
      status: payload.status,
      message: typeof payload.message === "string" ? payload.message : undefined,
      ts: String(event.created_at),
    }
    const parsed = TimelineEventSchema.safeParse(candidate)
    if (parsed.success) {
      timeline.push(parsed.data)
    }
  }

  const result = {
    status: String(runResult.data.status ?? "pending"),
    md_db_name:
      typeof runResult.data.md_db_name === "string" && runResult.data.md_db_name.length > 0
        ? runResult.data.md_db_name
        : undefined,
    fivetran_destination_id:
      typeof runResult.data.fivetran_destination_id === "string" &&
      runResult.data.fivetran_destination_id.length > 0
        ? runResult.data.fivetran_destination_id
        : undefined,
    timeline,
  }

  return StatusResponseSchema.parse(result)
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

import { createServiceClient } from "@hubble/db"
import { connect } from "@hubble/api-contracts"
import {
  acquireLock,
  releaseLock,
  publishEvent,
  type LockHandle,
  RedisUnavailableError,
} from "@hubble/redis"
import { logger } from "../logger"
import { appendEvent, updateProvisionRun, upsertTenantDestination } from "./db"
import { mdCreateServiceAccount, mdIssueToken, mdCreateDatabase } from "./motherduck"
import { fivetranUpsertMotherDuckDestination, fivetranTestDestination } from "./fivetran"

const LOCK_TTL_MS = 5 * 60_000

export class LockNotAcquiredError extends Error {
  constructor(lockKey: string) {
    super(`Failed to acquire lock: ${lockKey}`)
    this.name = "LockNotAcquiredError"
  }
}

export class LockServiceUnavailableError extends Error {
  constructor(lockKey: string) {
    super(`Lock service unavailable for key: ${lockKey}`)
    this.name = "LockServiceUnavailableError"
  }
}

export class ProvisionJobFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProvisionJobFailedError"
  }
}

export interface ProvisionJobPayload {
  orgId: string
  correlationId: string
}

const logStepFactory =
  (orgId: string, correlationId: string, channel: string) =>
  async (
    step: connect.ProvisionStep,
    status: connect.ProvisionEventStatus,
    message?: string,
    extra?: Record<string, unknown>,
  ) => {
    const { event_seq, ts } = await appendEvent(orgId, correlationId, step, status, message)

    // Enhanced logging with structured context
    const logContext = {
      correlation_id: correlationId,
      org_id: orgId,
      step,
      status,
      event_seq,
      ts,
      message,
      ...(extra ?? {}),
    }

    // Log to structured logger with appropriate level
    if (status === "failed") {
      logger.error("connect.provision.step.failed", logContext)
    } else if (status === "succeeded") {
      logger.info("connect.provision.step.succeeded", logContext)
    } else {
      logger.info("connect.provision.step.progress", logContext)
    }

    // Publish to Redis for real-time updates
    await publishEvent(channel, {
      correlation_id: correlationId,
      step,
      status,
      event_seq,
      ts,
      message,
      ...(extra ?? {}),
    })
  }

/**
 * Execute the provisioning workflow for a tenant. Throws LockNotAcquiredError if a
 * concurrent job is already running, and ProvisionJobFailedError when the workflow fails.
 */
export async function processProvisionJob(payload: ProvisionJobPayload): Promise<void> {
  const { orgId, correlationId } = payload
  const db = createServiceClient()
  const lockKey = `provision:org:${orgId}`
  const channel = `provision:events:${correlationId}`

  // Enhanced logging for job start
  logger.info("connect.provision.job.started", {
    correlation_id: correlationId,
    org_id: orgId,
    lock_key: lockKey,
    channel,
  })

  let lock: LockHandle | null = null
  try {
    logger.info("connect.provision.lock.attempting", {
      correlation_id: correlationId,
      org_id: orgId,
      lock_key: lockKey,
    })
    lock = await acquireLock(lockKey, LOCK_TTL_MS)
  } catch (error) {
    logger.error("connect.provision.lock.acquire_failed", {
      correlation_id: correlationId,
      org_id: orgId,
      lock_key: lockKey,
      error: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof RedisUnavailableError) {
      throw new LockServiceUnavailableError(lockKey)
    }
    throw error
  }

  if (!lock) {
    logger.warn("connect.provision.lock.not_acquired", {
      correlation_id: correlationId,
      org_id: orgId,
      lock_key: lockKey,
    })
    throw new LockNotAcquiredError(lockKey)
  }

  logger.info("connect.provision.lock.acquired", {
    correlation_id: correlationId,
    org_id: orgId,
    lock_key: lockKey,
    lock_token: lock.token,
  })

  const logStep = logStepFactory(orgId, correlationId, channel)

  try {
    await updateProvisionRun(correlationId, { status: "running" })

    const mdDbName = `md_${orgId}`
    const mdSaUsername = `sa_${orgId}`

    await logStep("CREATE_SERVICE_ACCOUNT", "started")
    await mdCreateServiceAccount(mdSaUsername)
    await logStep("CREATE_SERVICE_ACCOUNT", "succeeded")

    await logStep("ISSUE_SA_TOKEN", "started")
    const { token } = await mdIssueToken(mdSaUsername)
    try {
      await db.rpc("vault_set", { p_name: `md_sa_token:${orgId}`, p_secret: token })
    } catch {
      await db
        .from("vault.secrets" as never)
        .upsert({ name: `md_sa_token:${orgId}`, secret: token } as never)
    }
    await logStep("ISSUE_SA_TOKEN", "succeeded")

    await logStep("CREATE_TENANT_DATABASE", "started")
    await mdCreateDatabase(mdDbName, token)
    await logStep("CREATE_TENANT_DATABASE", "succeeded")

    await logStep("CONFIGURE_COMPUTE", "succeeded", "skipped/not-required")

    await logStep("CREATE_FIVETRAN_DESTINATION", "started")
    const { destination_id } = await fivetranUpsertMotherDuckDestination(
      `org:${orgId}`,
      mdDbName,
      `md_sa_token:${orgId}`,
    )
    await logStep("CREATE_FIVETRAN_DESTINATION", "succeeded", undefined, {
      fivetran_destination_id: destination_id,
    })

    await logStep("TEST_DESTINATION", "started")
    let ok = false
    for (let i = 0; i < 6; i++) {
      ok = await fivetranTestDestination(destination_id)
      if (ok) break
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i))
    }
    if (!ok) {
      throw new ProvisionJobFailedError("Destination test timeout")
    }
    await logStep("TEST_DESTINATION", "succeeded")

    await upsertTenantDestination(orgId, mdDbName, mdSaUsername, destination_id)
    await updateProvisionRun(correlationId, {
      status: "ready",
      md_db_name: mdDbName,
      md_sa_username: mdSaUsername,
      fivetran_destination_id: destination_id,
      finished_at: new Date().toISOString(),
    })

    logger.info("connect.provision.job.completed", {
      correlation_id: correlationId,
      org_id: orgId,
      md_db_name: mdDbName,
      md_sa_username: mdSaUsername,
      fivetran_destination_id: destination_id,
    })

    await logStep("READY", "succeeded")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    logger.error("connect.provision.job.failed", {
      correlation_id: correlationId,
      org_id: orgId,
      error: message,
      error_stack: error instanceof Error ? error.stack : undefined,
    })

    try {
      await logStep("ERROR", "failed", message)
    } catch (loggingError) {
      logger.error("connect.logstep.error", {
        correlation_id: correlationId,
        org_id: orgId,
        error: loggingError instanceof Error ? loggingError.message : String(loggingError),
      })
    }

    await updateProvisionRun(correlationId, {
      status: "failed",
      finished_at: new Date().toISOString(),
    })

    if (error instanceof ProvisionJobFailedError) {
      throw error
    }
    throw new ProvisionJobFailedError(message)
  } finally {
    if (lock) {
      try {
        await releaseLock(lock)
        logger.info("connect.provision.lock.released", {
          correlation_id: correlationId,
          org_id: orgId,
          lock_key: lock.key,
        })
      } catch (error) {
        logger.warn("connect.lock.release_failed", {
          correlation_id: correlationId,
          org_id: orgId,
          key: lock.key,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
}

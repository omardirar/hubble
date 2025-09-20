import { createServiceClient } from "@hubble/db"
import { connect } from "@hubble/api-contracts"
import {
  acquireLock,
  releaseLock,
  publishEvent,
  type LockHandle,
  RedisUnavailableError,
} from "@hubble/redis"
import { logger } from "@hubble/logger"
import { appendEvent, updateProvisionRun, upsertTenantDestination } from "./db"
import { mdCreateServiceAccount, mdIssueToken, mdCreateDatabase } from "./motherduck"
import {
  fivetranCreateGroup,
  fivetranUpsertMotherDuckDestination,
  fivetranTestDestination,
} from "./fivetran"

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

    // Check if provisioning is already complete (idempotency)
    try {
      const { data: existingDestination } = await db
        .from("tenant_destinations")
        .select("fivetran_destination_id, status")
        .eq("org_id", orgId)
        .single()

      if (existingDestination && existingDestination.status === "healthy") {
        logger.info("connect.provision.already_complete", {
          correlation_id: correlationId,
          org_id: orgId,
          fivetran_destination_id: existingDestination.fivetran_destination_id,
        })

        await updateProvisionRun(correlationId, {
          status: "ready",
          md_db_name: mdDbName,
          md_sa_username: mdSaUsername,
          fivetran_destination_id: existingDestination.fivetran_destination_id,
          finished_at: new Date().toISOString(),
        })

        await logStep("READY", "succeeded", "Provisioning already complete")
        return
      }
    } catch (checkError) {
      // Destination doesn't exist or error checking - continue with provisioning
      logger.debug("connect.provision.check_existing_destination", {
        correlation_id: correlationId,
        org_id: orgId,
        error: checkError instanceof Error ? checkError.message : String(checkError),
      })
    }

    await logStep("CREATE_SERVICE_ACCOUNT", "started")

    // Debug logging to verify username
    logger.info("connect.provision.create_service_account.debug", {
      correlation_id: correlationId,
      org_id: orgId,
      md_sa_username: mdSaUsername,
      username_type: typeof mdSaUsername,
      username_length: mdSaUsername?.length || 0,
    })

    try {
      await mdCreateServiceAccount(mdSaUsername)
      await logStep("CREATE_SERVICE_ACCOUNT", "succeeded")
    } catch (error) {
      // Enhanced error logging for debugging
      let errorMessage: string
      let errorDetails: Record<string, any>

      if (error instanceof Error) {
        errorMessage = error.message || error.name || "Unknown error"
        errorDetails = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      } else if (typeof error === "string") {
        errorMessage = error
        errorDetails = { error: error }
      } else if (error && typeof error === "object") {
        errorMessage = (error as any).message || (error as any).error || JSON.stringify(error)
        errorDetails = {
          type: typeof error,
          constructor: error.constructor?.name,
          ...error,
        }
      } else {
        errorMessage = String(error)
        errorDetails = { error: String(error) }
      }

      logger.error("connect.provision.create_service_account_failed", {
        correlation_id: correlationId,
        org_id: orgId,
        error: errorMessage,
        error_details: JSON.parse(JSON.stringify(errorDetails)),
      })
      await logStep("CREATE_SERVICE_ACCOUNT", "failed", errorMessage)
      throw error
    }

    await logStep("ISSUE_SA_TOKEN", "started")

    // Check if token already exists in vault (idempotency)
    let token: string
    let tokenFromVault = false

    try {
      const { data: existingToken } = await db.rpc("vault_get", { p_name: `md_sa_token:${orgId}` })
      if (existingToken && typeof existingToken === "string" && existingToken.length > 0) {
        logger.info("connect.provision.token_already_exists", {
          correlation_id: correlationId,
          org_id: orgId,
        })
        token = existingToken
        tokenFromVault = true
      } else {
        // Token doesn't exist, create a new one
        const { token: newToken } = await mdIssueToken(mdSaUsername)
        token = newToken
        tokenFromVault = false // Ensure we store the new token
      }
    } catch (vaultError) {
      logger.warn("connect.provision.vault_check_failed", {
        correlation_id: correlationId,
        org_id: orgId,
        error: vaultError instanceof Error ? vaultError.message : String(vaultError),
      })

      // If vault check fails, try to create a new token
      const { token: newToken } = await mdIssueToken(mdSaUsername)
      token = newToken
      tokenFromVault = false // Ensure we store the new token
    }

    // Store the token in vault (idempotent operation)
    if (!tokenFromVault) {
      logger.info("connect.provision.storing_token", {
        correlation_id: correlationId,
        org_id: orgId,
        token_length: token?.length || 0,
      })

      try {
        await db.rpc("vault_set", { p_name: `md_sa_token:${orgId}`, p_secret: token })
        logger.info("connect.provision.token_stored", {
          correlation_id: correlationId,
          org_id: orgId,
        })
      } catch (primaryError) {
        logger.warn("connect.provision.vault_primary_failed", {
          correlation_id: correlationId,
          org_id: orgId,
          error: primaryError instanceof Error ? primaryError.message : String(primaryError),
        })

        // Fallback to direct table insert
        try {
          await db
            .from("vault.secrets" as never)
            .upsert({ name: `md_sa_token:${orgId}`, secret: token } as never)
          logger.info("connect.provision.token_stored_fallback", {
            correlation_id: correlationId,
            org_id: orgId,
          })
        } catch (fallbackError) {
          logger.error("connect.provision.vault_fallback_failed", {
            correlation_id: correlationId,
            org_id: orgId,
            primaryError:
              primaryError instanceof Error ? primaryError.message : String(primaryError),
            fallbackError:
              fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          })
          throw new ProvisionJobFailedError(
            `Failed to store service account token: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
          )
        }
      }
    }

    await logStep("ISSUE_SA_TOKEN", "succeeded")

    await logStep("CREATE_TENANT_DATABASE", "started")
    await mdCreateDatabase(mdDbName, token)
    await logStep("CREATE_TENANT_DATABASE", "succeeded")

    await logStep("CONFIGURE_COMPUTE", "succeeded", "skipped/not-required")

    await logStep("CREATE_FIVETRAN_GROUP", "started")
    const { group_id } = await fivetranCreateGroup(`org:${orgId}`, `Organization ${orgId}`)
    await logStep("CREATE_FIVETRAN_GROUP", "succeeded", undefined, {
      fivetran_group_id: group_id,
    })

    await logStep("CREATE_FIVETRAN_DESTINATION", "started")
    const { destination_id } = await fivetranUpsertMotherDuckDestination(
      group_id,
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

    // Update tenant destination and provisioning run
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
    // Better error message extraction
    let message: string
    let errorDetails: Record<string, any>

    if (error instanceof Error) {
      message = error.message || error.name || "Unknown error"
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else if (typeof error === "string") {
      message = error
      errorDetails = { error: error }
    } else if (error && typeof error === "object") {
      // Handle objects that might not be Error instances
      message = (error as any).message || (error as any).error || JSON.stringify(error)
      errorDetails = {
        type: typeof error,
        constructor: error.constructor?.name,
        ...error,
      }
    } else {
      message = String(error)
      errorDetails = { error: String(error) }
    }

    // Ensure error details are properly serialized
    const serializedErrorDetails = JSON.parse(JSON.stringify(errorDetails))

    logger.error("connect.provision.job.failed", {
      correlation_id: correlationId,
      org_id: orgId,
      error: message,
      error_details: serializedErrorDetails,
    })

    // Update provisioning run to failed state first
    try {
      await updateProvisionRun(correlationId, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
    } catch (updateError) {
      logger.error("connect.provision.update_failed", {
        correlation_id: correlationId,
        org_id: orgId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      })
    }

    // Try to log the error step (this might fail, but we've already updated the status)
    try {
      await logStep("ERROR", "failed", message)
    } catch (loggingError) {
      logger.error("connect.logstep.error", {
        correlation_id: correlationId,
        org_id: orgId,
        error: loggingError instanceof Error ? loggingError.message : String(loggingError),
      })
    }

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

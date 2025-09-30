import { createServiceClient } from "@hubble/db"
import { connect } from "@hubble/schemas"
import {
  acquireLock,
  releaseLock,
  publishEvent,
  type LockHandle,
  RedisUnavailableError,
} from "@hubble/infrastructure/redis"
import { logger } from "@hubble/logger"
import {
  LockNotAcquiredError,
  LockServiceUnavailableError,
  ProvisionJobFailedError,
} from "@hubble/core"
import {
  appendEvent,
  updateProvisionRun,
  upsertTenantDestination,
  updateTenantProvisioningStatus,
} from "./db"
import { mdCreateServiceAccount, mdIssueToken, mdCreateDatabase } from "./motherduck"
import {
  fivetranCreateGroup,
  fivetranUpsertMotherDuckDestination,
  fivetranTestDestination,
} from "./fivetran"

const LOCK_TTL_MS = 5 * 60_000

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
// TODO: Add job timeout and cancellation support
//   Context: Implement timeout handling and cancellation for long-running provisioning jobs.
//   labels: area/utils, feature/connect, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

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
    // Update both provisioning run and tenant status to running
    await Promise.all([
      updateProvisionRun(correlationId, { status: "running" }),
      updateTenantProvisioningStatus(orgId, "running"),
    ])

    const mdDbName = `md_${orgId}`
    const mdSaUsername = `sa_${orgId}`

    // Check if provisioning is already complete (idempotency)
    try {
      const { data: existingDestination } = await db
        .from("data_destinations")
        .select("fivetran_destination_id, status")
        .eq("org_id", orgId)
        .single()

      if (existingDestination && existingDestination.status === "healthy") {
        logger.info("connect.provision.already_complete", {
          correlation_id: correlationId,
          org_id: orgId,
          fivetran_destination_id: existingDestination.fivetran_destination_id,
        })

        await Promise.all([
          updateProvisionRun(correlationId, {
            status: "ready",
            md_db_name: mdDbName,
            md_sa_username: mdSaUsername,
            fivetran_destination_id: existingDestination.fivetran_destination_id,
            finished_at: new Date().toISOString(),
          }),
          updateTenantProvisioningStatus(orgId, "ready"),
        ])

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

    // Check if token already exists in secrets table (idempotency)
    let token: string
    let tokenFromSecrets = false

    try {
      const { data: existingToken } = await db.rpc("get_secret", {
        p_org_id: orgId,
        p_secret_name: "md_sa_token",
      })
      if (existingToken && typeof existingToken === "string" && existingToken.length > 0) {
        logger.info("connect.provision.token_already_exists", {
          correlation_id: correlationId,
          org_id: orgId,
        })
        token = existingToken
        tokenFromSecrets = true
      } else {
        // Token doesn't exist, create a new one
        const { token: newToken } = await mdIssueToken(mdSaUsername)
        token = newToken
        tokenFromSecrets = false // Ensure we store the new token
      }
    } catch (secretsError) {
      logger.warn("connect.provision.secrets_check_failed", {
        correlation_id: correlationId,
        org_id: orgId,
        error: secretsError instanceof Error ? secretsError.message : String(secretsError),
      })

      // If secrets check fails, try to create a new token
      const { token: newToken } = await mdIssueToken(mdSaUsername)
      token = newToken
      tokenFromSecrets = false // Ensure we store the new token
    }

    // Store the token in secrets table (idempotent operation)
    if (!tokenFromSecrets) {
      logger.info("connect.provision.storing_token", {
        correlation_id: correlationId,
        org_id: orgId,
        token_length: token?.length || 0,
      })

      try {
        await db.rpc("set_secret", {
          p_org_id: orgId,
          p_secret_name: "md_sa_token",
          p_secret_value: token,
        })
      } catch (storageError) {
        logger.error("connect.provision.secrets_storage_failed", {
          correlation_id: correlationId,
          org_id: orgId,
          error: storageError instanceof Error ? storageError.message : String(storageError),
          errorStack: storageError instanceof Error ? storageError.stack : undefined,
        })
        throw new ProvisionJobFailedError(
          `Failed to store service account token: ${storageError instanceof Error ? storageError.message : String(storageError)}`,
        )
      }
    }

    await logStep("ISSUE_SA_TOKEN", "succeeded")

    await logStep("CREATE_TENANT_DATABASE", "started")

    await mdCreateDatabase(mdDbName, token)
    await logStep("CREATE_TENANT_DATABASE", "succeeded")

    await logStep("CONFIGURE_COMPUTE", "succeeded", "skipped/not-required")

    await logStep("CREATE_FIVETRAN_GROUP", "started")
    const { group_id } = await fivetranCreateGroup(orgId, orgId)
    await logStep("CREATE_FIVETRAN_GROUP", "succeeded", undefined, {
      fivetran_group_id: group_id,
    })

    await logStep("CREATE_FIVETRAN_DESTINATION", "started")

    // Retrieve the actual token from secrets table for Fivetran
    let actualToken: string
    try {
      const { data: secretsToken } = await db.rpc("get_secret", {
        p_org_id: orgId,
        p_secret_name: "md_sa_token",
      })
      if (!secretsToken || typeof secretsToken !== "string") {
        throw new ProvisionJobFailedError("Token not found in secrets table")
      }
      actualToken = secretsToken
      logger.info("connect.provision.token_retrieved_for_fivetran", {
        correlation_id: correlationId,
        org_id: orgId,
        token_length: actualToken.length,
      })
    } catch (secretsError) {
      logger.error("connect.provision.token_retrieval_failed", {
        correlation_id: correlationId,
        org_id: orgId,
        error: secretsError instanceof Error ? secretsError.message : String(secretsError),
      })
      throw new ProvisionJobFailedError(
        `Failed to retrieve token from secrets table: ${secretsError instanceof Error ? secretsError.message : String(secretsError)}`,
      )
    }

    const { destination_id } = await fivetranUpsertMotherDuckDestination(
      group_id,
      mdDbName,
      actualToken, // Pass the actual token, not the reference
    )
    await logStep("CREATE_FIVETRAN_DESTINATION", "succeeded", undefined, {
      fivetran_destination_id: destination_id,
    })

    await logStep("TEST_DESTINATION", "started")

    // Test destination once - Fivetran tests can take time but we don't need to retry
    const testResult = await fivetranTestDestination(destination_id)
    if (!testResult) {
      throw new ProvisionJobFailedError("Destination test failed")
    }
    await logStep("TEST_DESTINATION", "succeeded")

    // Update tenant destination, provisioning run, and tenant status
    await Promise.all([
      upsertTenantDestination(orgId, mdDbName, mdSaUsername, destination_id),
      updateProvisionRun(correlationId, {
        status: "ready",
        md_db_name: mdDbName,
        md_sa_username: mdSaUsername,
        fivetran_destination_id: destination_id,
        finished_at: new Date().toISOString(),
      }),
      updateTenantProvisioningStatus(orgId, "ready"),
    ])

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

    // Update both provisioning run and tenant status to failed
    try {
      await Promise.all([
        updateProvisionRun(correlationId, {
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: message,
        }),
        updateTenantProvisioningStatus(orgId, "failed", message),
      ])
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

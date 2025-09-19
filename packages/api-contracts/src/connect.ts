/**
 * Connect API Contracts
 *
 * Zod schemas and helpers for the Connect feature (provisioning MotherDuck + Fivetran).
 */

import { z } from "zod"

// ----------------------------------------------------------------------------
// Common enums
// ----------------------------------------------------------------------------

export const ProvisionStepSchema = z.enum([
  "CREATE_SERVICE_ACCOUNT",
  "ISSUE_SA_TOKEN",
  "CREATE_TENANT_DATABASE",
  "CONFIGURE_COMPUTE",
  "CREATE_FIVETRAN_DESTINATION",
  "TEST_DESTINATION",
  "ERROR",
  "READY",
])
export type ProvisionStep = z.infer<typeof ProvisionStepSchema>

export const ProvisionRunStatusSchema = z.enum(["pending", "running", "ready", "failed"])
export type ProvisionRunStatus = z.infer<typeof ProvisionRunStatusSchema>

export const ProvisionEventStatusSchema = z.enum(["started", "succeeded", "failed"])
export type ProvisionEventStatus = z.infer<typeof ProvisionEventStatusSchema>

// ----------------------------------------------------------------------------
// Requests
// ----------------------------------------------------------------------------

export const EnableRequestSchema = z.object({}) // org_id is derived from auth context
export type EnableRequest = z.infer<typeof EnableRequestSchema>

export const ProvisionJobPayloadSchema = z.object({
  org_id: z.string().min(1),
  correlation_id: z.string().min(1),
})
export type ProvisionJobPayload = z.infer<typeof ProvisionJobPayloadSchema>

// ----------------------------------------------------------------------------
// Responses
// ----------------------------------------------------------------------------

export const TimelineEventSchema = z.object({
  event_seq: z.number().int().nonnegative(),
  step: ProvisionStepSchema,
  status: ProvisionEventStatusSchema,
  message: z.string().optional(),
  ts: z.string(),
})
export type TimelineEvent = z.infer<typeof TimelineEventSchema>

export const EnableResponseSchema = z.object({
  correlation_id: z.string().min(1),
  status: z.literal("pending"),
})
export type EnableResponse = z.infer<typeof EnableResponseSchema>

export const StatusResponseSchema = z.object({
  status: ProvisionRunStatusSchema,
  md_db_name: z.string().optional(),
  fivetran_destination_id: z.string().optional(),
  timeline: z.array(TimelineEventSchema),
})
export type StatusResponse = z.infer<typeof StatusResponseSchema>

// ----------------------------------------------------------------------------
// Validation helpers
// ----------------------------------------------------------------------------

export function validateEnableRequest(data: unknown): EnableRequest {
  return EnableRequestSchema.parse(data)
}

export function validateEnableResponse(data: unknown): EnableResponse {
  return EnableResponseSchema.parse(data)
}

export function validateStatusResponse(data: unknown): StatusResponse {
  return StatusResponseSchema.parse(data)
}

export function validateTimelineEvent(data: unknown): TimelineEvent {
  return TimelineEventSchema.parse(data)
}

export function validateProvisionJobPayload(data: unknown): ProvisionJobPayload {
  return ProvisionJobPayloadSchema.parse(data)
}

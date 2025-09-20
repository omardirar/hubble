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
// Input validation schemas
// ----------------------------------------------------------------------------

export const MotherDuckUsernameSchema = z
  .string()
  .min(1, "Username is required")
  .max(100, "Username too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username contains invalid characters")
export type MotherDuckUsername = z.infer<typeof MotherDuckUsernameSchema>

export const MotherDuckTokenSchema = z
  .string()
  .min(10, "Token too short")
  .max(1000, "Token too long")
export type MotherDuckToken = z.infer<typeof MotherDuckTokenSchema>

export const MotherDuckDatabaseNameSchema = z
  .string()
  .min(1, "Database name is required")
  .max(100, "Database name too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Database name contains invalid characters")
export type MotherDuckDatabaseName = z.infer<typeof MotherDuckDatabaseNameSchema>

export const MDAdminTokenSchema = z
  .string()
  .min(10, "Admin token too short")
  .max(1000, "Admin token too long")
export type MDAdminToken = z.infer<typeof MDAdminTokenSchema>

export const FivetranApiKeySchema = z
  .string()
  .min(10, "API key too short")
  .max(100, "API key too long")
export type FivetranApiKey = z.infer<typeof FivetranApiKeySchema>

export const FivetranApiSecretSchema = z
  .string()
  .min(10, "API secret too short")
  .max(100, "API secret too long")
export type FivetranApiSecret = z.infer<typeof FivetranApiSecretSchema>

export const ExternalIdSchema = z
  .string()
  .min(1, "External ID is required")
  .max(100, "External ID too long")
export type ExternalId = z.infer<typeof ExternalIdSchema>

export const DestinationIdSchema = z
  .string()
  .min(1, "Destination ID is required")
  .max(100, "Destination ID too long")
export type DestinationId = z.infer<typeof DestinationIdSchema>

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

// Input validation helpers
export function validateMotherDuckUsername(username: unknown): MotherDuckUsername {
  return MotherDuckUsernameSchema.parse(username)
}

export function validateMotherDuckToken(token: unknown): MotherDuckToken {
  return MotherDuckTokenSchema.parse(token)
}

export function validateMotherDuckDatabaseName(dbName: unknown): MotherDuckDatabaseName {
  return MotherDuckDatabaseNameSchema.parse(dbName)
}

export function validateMDAdminToken(token: unknown): MDAdminToken {
  return MDAdminTokenSchema.parse(token)
}

export function validateFivetranApiKey(apiKey: unknown): FivetranApiKey {
  return FivetranApiKeySchema.parse(apiKey)
}

export function validateFivetranApiSecret(apiSecret: unknown): FivetranApiSecret {
  return FivetranApiSecretSchema.parse(apiSecret)
}

export function validateExternalId(externalId: unknown): ExternalId {
  return ExternalIdSchema.parse(externalId)
}

export function validateDestinationId(destinationId: unknown): DestinationId {
  return DestinationIdSchema.parse(destinationId)
}

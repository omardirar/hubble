/**
 * Chat API Contracts
 *
 * This module defines the TypeScript types and Zod schemas for all chat-related
 * API endpoints. It provides type safety and validation for both request and
 * response payloads across the web app and API worker.
 */

import { z } from "zod"

// =============================================================================
// Base Types
// =============================================================================

/**
 * Message role types as defined in the database schema
 */
export const MessageRoleSchema = z.enum(["user", "assistant", "system", "tool", "function"])
export type MessageRole = z.infer<typeof MessageRoleSchema>

/**
 * Message content structure
 */
export const MessageContentSchema = z.object({
  text: z.string(),
})
export type MessageContent = z.infer<typeof MessageContentSchema>

// =============================================================================
// Conversation Types
// =============================================================================

/**
 * Conversation summary as returned by the chat.conversations table
 */
export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  updated_at: z.string(), // Supabase timestamps are ISO strings but not always RFC3339
  archived_at: z.string().nullable(),
})
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>

/**
 * Full conversation details
 */
export const ConversationSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string(),
  owner_user_id: z.string(),
  title: z.string().nullable(),
  model: z.string().nullable(),
  system_prompt: z.string().nullable(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Conversation = z.infer<typeof ConversationSchema>

/**
 * Create conversation request
 */
export const CreateConversationRequestSchema = z.object({
  title: z.string().optional(),
})
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>

/**
 * Update conversation request
 */
export const UpdateConversationRequestSchema = z.object({
  title: z.string().optional(),
  archived: z.boolean().optional(),
})
export type UpdateConversationRequest = z.infer<typeof UpdateConversationRequestSchema>

// =============================================================================
// Chat Request Types
// =============================================================================

/**
 * Chat request for AI processing
 */
export const ChatRequestSchema = z.object({
  text: z.string().min(1, "Text cannot be empty").max(10000, "Text too long"),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>

/**
 * Chat response from AI
 */
export const ChatResponseSchema = z.object({
  reply: z.string(),
})
export type ChatResponse = z.infer<typeof ChatResponseSchema>

// =============================================================================
// Message Types
// =============================================================================

/**
 * Message as stored in the database
 */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  org_id: z.string(),
  owner_user_id: z.string(),
  author_user_id: z.string().nullable(),
  role: MessageRoleSchema,
  content: MessageContentSchema,
  model: z.string().nullable(),
  tool_name: z.string().nullable(),
  tool_call_id: z.string().nullable(),
  error: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
  idempotency_key: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Message = z.infer<typeof MessageSchema>

/**
 * Message as returned by the API (simplified)
 */
export const ApiMessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleSchema,
  text: z.string(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string(),
})
export type ApiMessage = z.infer<typeof ApiMessageSchema>

/**
 * Create message request
 */
export const CreateMessageRequestSchema = z.object({
  role: MessageRoleSchema.optional(),
  text: z.string().optional(),
  idempotencyKey: z.string().optional(),
})
export type CreateMessageRequest = z.infer<typeof CreateMessageRequestSchema>

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API error response
 */
export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  detail: z.string().optional(),
})
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>

/**
 * Success response for conversation creation
 */
export const CreateConversationResponseSchema = ConversationSchema
export type CreateConversationResponse = z.infer<typeof CreateConversationResponseSchema>

/**
 * Success response for conversation updates
 */
export const UpdateConversationResponseSchema = ConversationSchema
export type UpdateConversationResponse = z.infer<typeof UpdateConversationResponseSchema>

/**
 * Success response for message creation
 */
export const CreateMessageResponseSchema = MessageSchema
export type CreateMessageResponse = z.infer<typeof CreateMessageResponseSchema>

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates a conversation summary response
 */
export function validateConversationSummary(data: unknown): ConversationSummary {
  return ConversationSummarySchema.parse(data)
}

/**
 * Validates a conversation response
 */
export function validateConversation(data: unknown): Conversation {
  return ConversationSchema.parse(data)
}

/**
 * Validates an API message response
 */
export function validateApiMessage(data: unknown): ApiMessage {
  return ApiMessageSchema.parse(data)
}

/**
 * Validates a create conversation request
 */
export function validateCreateConversationRequest(data: unknown): CreateConversationRequest {
  return CreateConversationRequestSchema.parse(data)
}

/**
 * Validates a create message request
 */
export function validateCreateMessageRequest(data: unknown): CreateMessageRequest {
  return CreateMessageRequestSchema.parse(data)
}

/**
 * Validates an API error response
 */
export function validateApiErrorResponse(data: unknown): ApiErrorResponse {
  return ApiErrorResponseSchema.parse(data)
}

/**
 * Validates a chat request
 */
export function validateChatRequest(data: unknown): ChatRequest {
  return ChatRequestSchema.parse(data)
}

/**
 * Validates a chat response
 */
export function validateChatResponse(data: unknown): ChatResponse {
  return ChatResponseSchema.parse(data)
}

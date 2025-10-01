/**
 * Chat Database Operations
 *
 * This module provides database operations specifically for chat functionality
 * including conversations and messages with proper error handling and validation.
 */

import { createBrowserClient } from "@hubble/db"
import { logger } from "@hubble/logger"

type Logger = ReturnType<typeof logger.child>

export interface ConversationSummary {
  id: string
  title: string
  updated_at: string
  archived_at?: string
}

export interface Conversation {
  id: string
  title: string
  owner_user_id: string
  org_id: string
  created_at: string
  updated_at: string
  archived_at?: string
}

export interface Message {
  id: string
  conversation_id: string
  content: { text: string }
  role: string
  author_user_id?: string
  model?: string
  tool_name?: string
  tool_call_id?: string
  error?: string
  metadata?: Record<string, unknown>
  idempotency_key?: string
  created_at: string
  updated_at: string
}

/**
 * Get conversations for a user
 */
export async function getConversations(
  supabase: ReturnType<typeof createBrowserClient>,
  requestLogger: Logger,
): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,updated_at,archived_at")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })

  if (error) {
    requestLogger.error("Database error fetching conversations", { error: error.message })
    throw new Error(`Database error: ${error.message}`)
  }

  return data || []
}

/**
 * Create a new conversation
 */
export async function createConversation(
  supabase: ReturnType<typeof createBrowserClient>,
  title: string,
  userId: string,
  orgId: string,
  requestLogger: Logger,
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      title,
      owner_user_id: userId,
      org_id: orgId,
    })
    .select()
    .single()

  if (error) {
    requestLogger.error("Database error creating conversation", { error: error.message })
    throw new Error(`Database error: ${error.message}`)
  }

  return data
}

/**
 * Update a conversation
 */
export async function updateConversation(
  supabase: ReturnType<typeof createBrowserClient>,
  id: string,
  updates: Record<string, unknown>,
  requestLogger: Logger,
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      requestLogger.warn("Conversation not found", { id })
      throw new Error("Conversation not found")
    }

    requestLogger.error("Database error updating conversation", { error: error.message })
    throw new Error(`Database error: ${error.message}`)
  }

  return data
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  supabase: ReturnType<typeof createBrowserClient>,
  conversationId: string,
  requestLogger: Logger,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, content, role, author_user_id, model, tool_name, tool_call_id, error, metadata, idempotency_key, created_at, updated_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (error) {
    requestLogger.error("Database error fetching messages", { error: error.message })
    throw new Error(`Database error: ${error.message}`)
  }

  return data || []
}

/**
 * Create a new message
 */
export async function createMessage(
  supabase: ReturnType<typeof createBrowserClient>,
  conversationId: string,
  text: string,
  role: string,
  idempotencyKey: string,
  orgId: string,
  ownerUserId: string,
  requestLogger: Logger,
  metadata?: Record<string, unknown>,
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      org_id: orgId,
      owner_user_id: ownerUserId,
      content: { text },
      role,
      metadata: metadata || {},
      idempotency_key: idempotencyKey,
    })
    .select(
      "id, conversation_id, content, role, author_user_id, model, tool_name, tool_call_id, error, metadata, idempotency_key, created_at, updated_at",
    )
    .single()

  if (error) {
    requestLogger.error("Database error creating message", { error: error.message })
    throw new Error(`Database error: ${error.message}`)
  }

  return data
}

/**
 * Check if a message with the same idempotency_key already exists (for idempotency)
 */
export async function findExistingMessage(
  supabase: ReturnType<typeof createBrowserClient>,
  conversationId: string,
  idempotencyKey: string,
  requestLogger: Logger,
): Promise<Message | null> {
  const { data } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, content, role, author_user_id, model, tool_name, tool_call_id, error, idempotency_key, created_at, updated_at",
    )
    .eq("conversation_id", conversationId)
    .eq("idempotency_key", idempotencyKey)
    .single()

  return data || null
}

/**
 * Verify user has access to a conversation
 */
export async function verifyConversationAccess(
  supabase: ReturnType<typeof createBrowserClient>,
  conversationId: string,
  requestLogger: Logger,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .single()

  if (error || !data) {
    requestLogger.warn("Conversation not found or access denied", { conversationId })
    return false
  }

  return true
}

// TODO: Add caching for conversation access verification
//   Context: Implement Redis-based caching for conversation access checks to reduce database load.
//   labels: area/chat, feature/performance, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

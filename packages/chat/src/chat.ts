/**
 * Chat Utilities
 *
 * This module provides utilities for chat functionality including message
 * loading, content processing, and type definitions for chat operations.
 */

import { apiFetch } from "@hubble/core"

/**
 * Chat message type definition
 *
 * Represents a single message in a chat conversation with role-based
 * typing for different message types (user, assistant, system).
 */
export type ChatMessage = {
  id: string // Unique message identifier
  role: "user" | "assistant" // Message role/sender type
  text: string // Message content
  created_at?: string // Optional creation timestamp
}

/**
 * Load messages for a specific conversation
 *
 * This function fetches messages for a given conversation ID from the API.
 * Returns all messages for the conversation.
 *
 * @param id - The conversation ID to load messages for
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Promise that resolves to chat messages
 *
 * @example
 * ```ts
 * const messages = await loadMessages("conv-123")
 * // Returns: ChatMessage[] with all messages
 * ```
 */
export async function loadMessages(id: string, signal?: AbortSignal) {
  // Fetch messages from the API endpoint
  const r = await apiFetch(`/api/v1/chat/messages/${id}`, { signal })
  const rows = (await r.json()) as ChatMessage[]

  // Return all messages (no filtering needed since we only have user/assistant)
  return rows
}

/**
 * Convert unknown content to text string
 *
 * This utility function safely converts various content types to a string
 * representation. It handles strings, objects with text properties, and
 * other unknown types gracefully.
 *
 * @param content - The content to convert to text
 * @returns String representation of the content
 *
 * @example
 * ```ts
 * contentToText("Hello") // "Hello"
 * contentToText({ text: "World" }) // "World"
 * contentToText(null) // ""
 * ```
 */
export function contentToText(content: unknown): string {
  // Handle string content directly
  if (typeof content === "string") return content

  // Handle object content with text property
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>
    if ("text" in obj) {
      const v = (obj as { text?: unknown }).text
      return v != null ? String(v) : ""
    }
  }

  // Return empty string for all other cases
  return ""
}

// TODO: Add cursor helpers for chat pagination
//   Context: Provide helpers to build next/prev cursors and merge message pages without duplication.
//   labels: area/utils, feature/chat, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

/**
 * Chat Utilities
 *
 * This module provides utilities for chat functionality including message
 * loading, content processing, and type definitions for chat operations.
 */

import { apiFetch } from "./fetch"

/**
 * Chat message type definition
 *
 * Represents a single message in a chat conversation with role-based
 * typing for different message types (user, assistant, system).
 */
export type ChatMessage = {
  id: string // Unique message identifier
  role: "user" | "assistant" | "system" // Message role/sender type
  text: string // Message content
}

/**
 * Load messages for a specific conversation
 *
 * This function fetches messages for a given conversation ID from the API.
 * It filters out system messages and returns only user and assistant messages
 * for display purposes.
 *
 * @param id - The conversation ID to load messages for
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Promise that resolves to filtered chat messages
 *
 * @example
 * ```ts
 * const messages = await loadMessages("conv-123")
 * // Returns: ChatMessage[] with only user and assistant messages
 * ```
 */
export async function loadMessages(id: string, signal?: AbortSignal) {
  // Fetch messages from the API endpoint
  const r = await apiFetch(`/api/v1/chat/messages/${id}`, { signal })
  const rows = (await r.json()) as ChatMessage[]

  // Filter out system messages, keeping only user and assistant messages
  return rows.filter(
    (m): m is Omit<ChatMessage, "role"> & { role: "user" | "assistant" } =>
      m.role === "user" || m.role === "assistant",
  )
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

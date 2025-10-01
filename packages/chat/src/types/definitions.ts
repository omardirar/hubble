/**
 * Chat Types
 *
 * Centralized type definitions for the chat feature.
 */

export type MessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  role: MessageRole
  text: string
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface ChatConversation {
  id: string
  title: string
  updated_at?: string
  archived_at?: string | null
}

export interface ChatError {
  code: string
  message: string
  details?: unknown
}

export interface StreamingOptions {
  onStart?: () => void
  onToken?: (token: string) => void
  onFinish?: (content: string) => void
  onError?: (error: ChatError) => void
}

export interface ChatAPIRequest {
  messages: Array<{
    role: MessageRole
    text: string
  }>
}

export interface ChatAPIResponse {
  id?: string
  content?: string
  error?: ChatError
}

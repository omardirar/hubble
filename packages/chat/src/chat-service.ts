/**
 * Chat Service
 *
 * Provides high-level chat functionality including sending messages,
 * managing conversations, and handling chat state.
 */

import { apiFetch, generateId } from "@hubble/core"
import { logger } from "@hubble/logger"
import { validateChatRequest, validateChatResponse } from "@hubble/schemas/chat"
import type { ChatMessage } from "./chat"
import type { Conversation } from "./db"

/**
 * Chat service class for managing chat operations
 */
export class ChatService {
  /**
   * Send a message to the chat API and get AI response
   *
   * @param text - The message text to send
   * @param conversationHistory - Previous messages for context
   * @returns Promise<string> - The AI response
   */
  static async sendMessage(text: string, conversationHistory: ChatMessage[] = []): Promise<string> {
    // Validate input
    const validatedRequest = validateChatRequest({ text })

    const res = await apiFetch("/api/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...validatedRequest,
        history: conversationHistory.map((m) => ({
          role: m.role,
          text: m.text,
        })),
      }),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error")
      logger.error("chat.send_message_failed", {
        status: res.status,
        errorText,
        textLength: text.length,
      })
      throw new Error(`Failed to get AI response: ${errorText}`)
    }

    const data = (await res.json().catch(() => ({}))) as { reply?: string }
    const validatedResponse = validateChatResponse({ reply: data.reply ?? "" })

    return validatedResponse.reply
  }

  /**
   * Create a new conversation
   *
   * @param title - The conversation title
   * @returns Promise<Conversation> - The created conversation
   */
  static async createConversation(title: string = "New Chat"): Promise<Conversation> {
    try {
      const response = await apiFetch("/api/v1/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Failed to create conversation: ${response.status} - ${errorText}`)
      }

      const conversation = (await response.json()) as Conversation
      logger.info("chat.conversation_created", { id: conversation.id, title })

      return conversation
    } catch (error) {
      logger.error("chat.create_conversation_failed", {
        error: error instanceof Error ? error.message : String(error),
        title,
      })
      throw error
    }
  }

  /**
   * Load messages for a conversation
   *
   * @param conversationId - The conversation ID
   * @param signal - Optional abort signal for cancellation
   * @returns Promise<ChatMessage[]> - Array of messages
   */
  static async loadMessages(conversationId: string, signal?: AbortSignal): Promise<ChatMessage[]> {
    try {
      const response = await apiFetch(`/api/v1/chat/messages/${conversationId}`, {
        signal,
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Check you're signed in and in the correct workspace.")
        }
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Failed to load messages: ${response.status} - ${errorText}`)
      }

      const messages = (await response.json()) as ChatMessage[]
      logger.info("chat.messages_loaded", {
        conversationId,
        count: messages.length,
      })

      return messages
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error // Re-throw abort errors
      }

      logger.error("chat.load_messages_failed", {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
      })
      throw error
    }
  }

  /**
   * Load all conversations for the sidebar
   *
   * @returns Promise<Conversation[]> - Array of conversations
   */
  static async loadConversations(): Promise<Conversation[]> {
    try {
      const response = await apiFetch("/api/v1/chat/conversations")

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Failed to load conversations: ${response.status} - ${errorText}`)
      }

      const conversations = (await response.json()) as Conversation[]
      logger.info("chat.conversations_loaded", { count: conversations.length })

      return conversations
    } catch (error) {
      logger.error("chat.load_conversations_failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Save a message to a conversation
   *
   * @param conversationId - The conversation ID
   * @param message - The message to save
   * @returns Promise<ChatMessage> - The saved message
   */
  static async saveMessage(
    conversationId: string,
    message: { role: "user" | "assistant"; text: string },
  ): Promise<ChatMessage> {
    try {
      const idempotencyKey = generateId()

      const response = await apiFetch(`/api/v1/chat/messages/${conversationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...message,
          idempotencyKey,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Failed to save message: ${response.status} - ${errorText}`)
      }

      const savedMessage = (await response.json()) as ChatMessage
      logger.info("chat.message_saved", {
        conversationId,
        messageId: savedMessage.id,
      })

      return savedMessage
    } catch (error) {
      logger.error("chat.save_message_failed", {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
        role: message.role,
      })
      throw error
    }
  }

  /**
   * Update conversation title
   *
   * @param conversationId - The conversation ID
   * @param title - The new title
   * @returns Promise<void>
   */
  static async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    try {
      const response = await apiFetch(`/api/v1/chat/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Failed to update conversation: ${response.status} - ${errorText}`)
      }

      logger.info("chat.conversation_updated", { conversationId, title })
    } catch (error) {
      logger.error("chat.update_conversation_failed", {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
        title,
      })
      throw error
    }
  }

  /**
   * Rename a conversation (alias for updateConversationTitle)
   *
   * @param conversationId - The conversation ID
   * @param title - The new title
   * @returns Promise<void>
   */
  static async renameConversation(conversationId: string, title: string): Promise<void> {
    return this.updateConversationTitle(conversationId, title)
  }

  /**
   * Auto-generate and update conversation title based on first message
   *
   * @param conversationId - The conversation ID
   * @param firstMessage - The first user message
   * @returns Promise<string> - The generated title
   */
  static async autoGenerateTitle(conversationId: string, firstMessage: string): Promise<string> {
    try {
      // Generate title using AI
      const response = await apiFetch("/api/v1/chat/generate-title", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: firstMessage }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Failed to generate title: ${response.status} - ${errorText}`)
      }

      const { title } = (await response.json()) as { title: string }

      // Update conversation with generated title
      await this.updateConversationTitle(conversationId, title)

      logger.info("chat.title_auto_generated", { conversationId, title })

      return title
    } catch (error) {
      logger.error("chat.auto_generate_title_failed", {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
      })
      throw error
    }
  }

  /**
   * Archive a conversation
   *
   * @param conversationId - The conversation ID
   * @returns Promise<void>
   */
  static async archiveConversation(conversationId: string): Promise<void> {
    try {
      const response = await apiFetch(`/api/v1/chat/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Failed to archive conversation: ${response.status} - ${errorText}`)
      }

      logger.info("chat.conversation_archived", { conversationId })
    } catch (error) {
      logger.error("chat.archive_conversation_failed", {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
      })
      throw error
    }
  }
}

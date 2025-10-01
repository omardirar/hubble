"use client"

/**
 * Chat State Management Hook
 *
 * Provides a custom hook for managing chat state including messages,
 * conversations, and loading states.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { logger } from "@hubble/logger"
import type { ChatMessage } from "./chat"
import { ChatService } from "./chat-service"
import type { Conversation } from "./db"

/**
 * Chat state interface
 */
export interface ChatState {
  // Messages
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void

  // Conversations
  conversations: Conversation[]
  setConversations: (conversations: Conversation[]) => void

  // Current conversation
  currentConversationId: string | null
  setCurrentConversationId: (id: string | null) => void

  // Loading states
  isSidebarLoading: boolean
  setIsSidebarLoading: (loading: boolean) => void
  isSending: boolean
  setIsSending: (sending: boolean) => void

  // Input
  input: string
  setInput: (input: string) => void

  // Refresh action
  refreshSidebar: () => Promise<void>
}

/**
 * Chat actions interface
 */
export interface ChatActions {
  // Message actions
  sendMessage: () => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>

  // Conversation actions
  createConversation: (title?: string) => Promise<string | null>
  loadConversations: () => Promise<void>
  selectConversation: (id: string | null) => void
  renameConversation: (id: string, title: string) => Promise<void>
  archiveConversation: (id: string) => Promise<void>
  startNewChat: () => void

  // Utility actions
  clearInput: () => void
}

/**
 * Custom hook for managing chat state and actions
 *
 * @param initialConversationId - Optional initial conversation ID
 * @returns Object containing state and actions
 */
export function useChatState(initialConversationId?: string | null): ChatState & ChatActions {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    initialConversationId ?? null,
  )
  const [isSidebarLoading, setIsSidebarLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [input, setInput] = useState("")

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null)

  // Actions
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      const messages = await ChatService.loadMessages(
        conversationId,
        abortControllerRef.current.signal,
      )
      setMessages(messages)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return // Ignore abort errors
      }

      const errorMessage = error instanceof Error ? error.message : "Failed to load messages"
      toast.error(errorMessage)
      logger.error("chat.load_messages_hook_failed", {
        error: errorMessage,
        conversationId,
      })
    }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      setIsSidebarLoading(true)
      const conversations = await ChatService.loadConversations()
      setConversations(conversations)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load conversations"
      toast.error(errorMessage)
      logger.error("chat.load_conversations_hook_failed", {
        error: errorMessage,
      })
    } finally {
      setIsSidebarLoading(false)
    }
  }, [])

  const createConversation = useCallback(
    async (title: string = "New Chat"): Promise<string | null> => {
      try {
        const conversation = await ChatService.createConversation(title)
        setCurrentConversationId(conversation.id)
        setMessages([])
        return conversation.id
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create conversation"
        toast.error(errorMessage)
        logger.error("chat.create_conversation_hook_failed", {
          error: errorMessage,
          title,
        })
        return null
      }
    },
    [],
  )

  const refreshSidebar = useCallback(async () => {
    try {
      const conversations = await ChatService.loadConversations()
      setConversations(conversations)
    } catch (error) {
      // Error already logged in ChatService
      logger.error("chat.refresh_sidebar_failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || isSending) return

    setIsSending(true)
    const userMessageId = `user-${Date.now()}`
    const assistantMessageId = `assistant-${Date.now()}`

    try {
      // Ensure we have a conversation
      let targetConversationId = currentConversationId
      if (!targetConversationId) {
        targetConversationId = await createConversation()
        if (!targetConversationId) {
          setIsSending(false)
          return
        }
      }

      // Add user message optimistically
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        text: trimmedInput,
      }
      setMessages((prev) => [...prev, userMessage])
      setInput("")

      try {
        // Save user message
        const savedUserMessage = await ChatService.saveMessage(targetConversationId, {
          role: "user",
          text: trimmedInput,
        })

        // Update with real ID from database
        setMessages((prev) =>
          prev.map((m) => (m.id === userMessageId ? { ...m, id: savedUserMessage.id } : m)),
        )

        // Get AI response with conversation context
        const conversationHistory = [...messages, { ...userMessage, id: savedUserMessage.id }]
        const aiResponse = await ChatService.sendMessage(trimmedInput, conversationHistory)

        // Add AI response optimistically
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          text: aiResponse,
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Save AI response
        const savedAssistantMessage = await ChatService.saveMessage(targetConversationId, {
          role: "assistant",
          text: aiResponse,
        })

        // Update with real ID from database
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, id: savedAssistantMessage.id } : m,
          ),
        )

        // Refresh sidebar to update conversation order
        await refreshSidebar()

        logger.info("chat.message_sent_successfully", {
          conversationId: targetConversationId,
          messageLength: trimmedInput.length,
        })
      } catch (error) {
        // Roll back optimistic updates on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== userMessageId && m.id !== assistantMessageId),
        )
        setInput(trimmedInput) // Restore input

        throw error // Re-throw to outer catch
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send message"
      toast.error(errorMessage)
      logger.error("chat.send_message_hook_failed", {
        error: errorMessage,
        inputLength: trimmedInput.length,
      })
    } finally {
      setIsSending(false)
    }
  }, [input, isSending, currentConversationId, createConversation, refreshSidebar])

  const selectConversation = useCallback(
    (id: string | null) => {
      setCurrentConversationId(id)
      if (id) {
        loadMessages(id)
      } else {
        setMessages([])
      }
    },
    [loadMessages],
  )

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      await ChatService.updateConversationTitle(id, title)
      setConversations((prev) => prev.map((conv) => (conv.id === id ? { ...conv, title } : conv)))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to rename conversation"
      toast.error(errorMessage)
      logger.error("chat.rename_conversation_hook_failed", {
        error: errorMessage,
        conversationId: id,
        title,
      })
    }
  }, [])

  const archiveConversation = useCallback(
    async (id: string) => {
      try {
        await ChatService.archiveConversation(id)
        setConversations((prev) => prev.filter((conv) => conv.id !== id))

        // If this was the current conversation, clear it
        if (currentConversationId === id) {
          setCurrentConversationId(null)
          setMessages([])
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to archive conversation"
        toast.error(errorMessage)
        logger.error("chat.archive_conversation_hook_failed", {
          error: errorMessage,
          conversationId: id,
        })
      }
    },
    [currentConversationId],
  )

  const startNewChat = useCallback(() => {
    setCurrentConversationId(null)
    setMessages([])
    setInput("")
  }, [])

  const clearInput = useCallback(() => {
    setInput("")
  }, [])

  // Effects
  useEffect(() => {
    // Load conversations on mount
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    // Load messages when conversation changes
    if (currentConversationId) {
      loadMessages(currentConversationId)
    }
  }, [currentConversationId, loadMessages])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    // State
    messages,
    setMessages,
    conversations,
    setConversations,
    currentConversationId,
    setCurrentConversationId,
    isSidebarLoading,
    setIsSidebarLoading,
    isSending,
    setIsSending,
    input,
    setInput,
    refreshSidebar,

    // Actions
    sendMessage,
    loadMessages,
    createConversation,
    loadConversations,
    selectConversation,
    renameConversation,
    archiveConversation,
    startNewChat,
    clearInput,
  }
}

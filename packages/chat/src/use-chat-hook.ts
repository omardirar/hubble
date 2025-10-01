/**
 * Chat Hook for AI SDK v5
 *
 * Provides a React hook for managing chat state with streaming AI responses.
 * Uses AI SDK v5 primitives for streaming and message management.
 */

"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { toast } from "sonner"
import { logger } from "@hubble/logger"
import { ChatService } from "./chat-service"
import type { Conversation } from "./db"
import type { ChatMessage } from "./types"

export interface UseChatOptions {
  api?: string
  initialConversationId?: string | null
  onError?: (error: Error) => void
  onFinish?: (message: ChatMessage) => void
}

export interface UseChatReturn {
  // State
  messages: ChatMessage[]
  input: string
  isLoading: boolean
  conversations: Conversation[]
  currentConversationId: string | null
  isSidebarLoading: boolean

  // Actions
  setInput: (input: string) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  reload: () => Promise<void>
  stop: () => void

  // Conversation management
  loadConversations: () => Promise<void>
  selectConversation: (id: string | null) => Promise<void>
  startNewChat: () => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  archiveConversation: (id: string) => Promise<void>
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { api = "/api/v1/chat", initialConversationId = null, onError, onFinish } = options

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    initialConversationId,
  )
  const [isSidebarLoading, setIsSidebarLoading] = useState(false)

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setIsSidebarLoading(true)
      const convs = await ChatService.loadConversations()
      setConversations(convs)
    } catch (error) {
      toast.error("Failed to load conversations")
      logger.error("chat.load_conversations_failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsSidebarLoading(false)
    }
  }, [])

  // Select conversation
  const selectConversation = useCallback(async (id: string | null) => {
    setCurrentConversationId(id)
    if (id) {
      try {
        const msgs = await ChatService.loadMessages(id)
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            text: m.text,
            created_at: m.created_at,
          })),
        )
      } catch (error) {
        toast.error("Failed to load messages")
        logger.error("chat.load_messages_failed", {
          error: error instanceof Error ? error.message : String(error),
          conversationId: id,
        })
      }
    } else {
      setMessages([])
    }
  }, [])

  // Start new chat
  const startNewChat = useCallback(async () => {
    try {
      const conversation = await ChatService.createConversation("New Chat")
      setCurrentConversationId(conversation.id)
      setMessages([])
      await loadConversations()
      toast.success("New conversation started")
    } catch (error) {
      toast.error("Failed to create conversation")
      logger.error("chat.create_conversation_failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [loadConversations])

  // Rename conversation
  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      await ChatService.updateConversationTitle(id, title)
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
      toast.success("Conversation renamed")
    } catch (error) {
      toast.error("Failed to rename conversation")
      logger.error("chat.rename_conversation_failed", {
        error: error instanceof Error ? error.message : String(error),
        conversationId: id,
      })
    }
  }, [])

  // Archive conversation
  const archiveConversation = useCallback(
    async (id: string) => {
      try {
        await ChatService.archiveConversation(id)
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (currentConversationId === id) {
          setCurrentConversationId(null)
          setMessages([])
        }
        toast.success("Conversation archived")
      } catch (error) {
        toast.error("Failed to archive conversation")
        logger.error("chat.archive_conversation_failed", {
          error: error instanceof Error ? error.message : String(error),
          conversationId: id,
        })
      }
    },
    [currentConversationId],
  )

  // Handle submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || isLoading) return

      const trimmedInput = input.trim()
      setInput("")
      setIsLoading(true)

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        // Ensure we have a conversation
        let convId = currentConversationId
        if (!convId) {
          const conv = await ChatService.createConversation("New Chat")
          convId = conv.id
          setCurrentConversationId(convId)
          await loadConversations()
        }

        // Add user message optimistically
        const userMessage: ChatMessage = {
          id: `temp-user-${Date.now()}`,
          role: "user",
          text: trimmedInput,
        }
        setMessages((prev) => [...prev, userMessage])

        // Save user message
        await ChatService.saveMessage(convId, {
          role: "user",
          text: trimmedInput,
        })

        // Stream AI response
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              text: m.text,
            })),
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let assistantContent = ""
        const assistantId = `temp-assistant-${Date.now()}`

        // Add empty assistant message
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          text: "",
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Stream the response
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          assistantContent += chunk

          // Update assistant message with streamed content
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m)),
          )
        }

        // Save assistant message
        await ChatService.saveMessage(convId, {
          role: "assistant",
          text: assistantContent,
        })

        // Refresh conversations list
        await loadConversations()

        // Call onFinish callback
        if (onFinish) {
          onFinish({ ...assistantMessage, text: assistantContent })
        }

        logger.info("chat.message_sent_successfully", {
          conversationId: convId,
          messageLength: trimmedInput.length,
          responseLength: assistantContent.length,
        })
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          logger.info("chat.request_aborted", {})
          return
        }

        const errorMessage = error instanceof Error ? error.message : "Failed to send message"
        toast.error(errorMessage)
        logger.error("chat.send_message_failed", {
          error: errorMessage,
          inputLength: trimmedInput.length,
        })

        if (onError && error instanceof Error) {
          onError(error)
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [input, isLoading, currentConversationId, messages, api, loadConversations, onFinish, onError],
  )

  // Reload last message
  const reload = useCallback(async () => {
    if (messages.length < 2) return

    // Remove last assistant message
    const filteredMessages = messages.slice(0, -1)
    const lastUserMessage = filteredMessages[filteredMessages.length - 1]

    if (!lastUserMessage || lastUserMessage.role !== "user") return

    setMessages(filteredMessages)
    setInput(lastUserMessage.text)

    // Re-submit
    const event = new Event("submit") as unknown as React.FormEvent
    await handleSubmit(event)
  }, [messages, handleSubmit])

  // Stop streaming
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
  }, [])

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    messages,
    input,
    isLoading,
    conversations,
    currentConversationId,
    isSidebarLoading,
    setInput,
    handleSubmit,
    reload,
    stop,
    loadConversations,
    selectConversation,
    startNewChat,
    renameConversation,
    archiveConversation,
  }
}

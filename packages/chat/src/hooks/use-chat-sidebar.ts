"use client"

import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { ChatService } from "../services/chat-service"
import type { ChatConversation } from "../types/definitions"
import { logger } from "@hubble/logger"

export interface UseChatSidebarReturn {
  conversations: ChatConversation[]
  currentConversationId: string | null
  isLoading: boolean
  loadConversations: () => Promise<void>
  selectConversation: (id: string | null) => Promise<void>
  startNewChat: () => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  archiveConversation: (id: string) => Promise<void>
}

export function useChatSidebar(): UseChatSidebarReturn {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      const loadedConversations = await ChatService.loadConversations()
      setConversations(loadedConversations)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load conversations"
      toast.error(errorMessage)
      logger.error("chat.load_conversations_failed", { error: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const selectConversation = useCallback(async (id: string | null) => {
    setCurrentConversationId(id)
  }, [])

  const startNewChat = useCallback(async () => {
    setCurrentConversationId(null)
  }, [])

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        await ChatService.renameConversation(id, title)
        await loadConversations()
        toast.success("Conversation renamed")
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to rename conversation"
        toast.error(errorMessage)
        logger.error("chat.rename_conversation_failed", {
          conversationId: id,
          error: errorMessage,
        })
      }
    },
    [loadConversations],
  )

  const archiveConversation = useCallback(
    async (id: string) => {
      try {
        await ChatService.archiveConversation(id)
        await loadConversations()
        if (currentConversationId === id) {
          setCurrentConversationId(null)
        }
        toast.success("Conversation archived")
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to archive conversation"
        toast.error(errorMessage)
        logger.error("chat.archive_conversation_failed", {
          conversationId: id,
          error: errorMessage,
        })
      }
    },
    [loadConversations, currentConversationId],
  )

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  return {
    conversations,
    currentConversationId,
    isLoading,
    loadConversations,
    selectConversation,
    startNewChat,
    renameConversation,
    archiveConversation,
  }
}

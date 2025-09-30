"use client"

/**
 * Chat Page Component
 *
 * Main chat interface providing a conversational AI experience with
 * message history, conversation management, and real-time interactions.
 *
 * Features:
 * - Real-time chat with AI assistant
 * - Conversation history and management
 * - Message persistence and loading
 * - Optimistic UI updates
 * - Error handling and user feedback
 */

import * as React from "react"
import { ChatConversation } from "@hubble/ui/blocks"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@hubble/ui/blocks"
import { ChatSidebar } from "@hubble/ui/blocks"
import { Separator } from "@hubble/ui"
import { useChatList } from "@hubble/ui"
import { useChatState } from "@hubble/chat"

export default function ChatPage() {
  // Get local chat sessions for fallback
  const { sessions } = useChatList()

  // Use custom chat state management hook
  const {
    // State
    messages,
    conversations,
    currentConversationId,
    isSidebarLoading,
    isSending,
    input,
    setInput,

    // Actions
    sendMessage,
    selectConversation,
    renameConversation,
    archiveConversation,
    startNewChat,
  } = useChatState()

  /**
   * Handle form submission for sending messages
   */
  const handleSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      sendMessage()
    },
    [sendMessage],
  )

  /**
   * Handle input change with debouncing for better performance
   */
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.currentTarget.value)
    },
    [setInput],
  )

  // Use server conversations if available, otherwise fall back to local sessions
  const sidebarItems = conversations.length > 0 ? conversations : sessions

  return (
    <div className="flex h-full min-h-0 min-w-0 gap-0 pt-0 pr-0">
      {/* Chat Sidebar */}
      <ChatSidebar
        side="left"
        activeId={currentConversationId}
        isLoading={isSidebarLoading}
        items={sidebarItems}
        onSelectChat={selectConversation}
        onNewChat={startNewChat}
        onRename={renameConversation}
        onArchive={archiveConversation}
      />

      {/* Separator */}
      <Separator orientation="vertical" />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Message Display */}
        <ChatConversation messages={messages} isTyping={isSending} />

        {/* Message Input */}
        <div className="p-3">
          <PromptInput className="" onSubmit={handleSubmit}>
            <PromptInputTextarea
              value={input}
              onChange={handleInputChange}
              placeholder="Say something..."
              minRows={2}
              maxRows={10}
              autoFocus
            />
            <PromptInputToolbar>
              <PromptInputTools />
              <PromptInputSubmit
                status={isSending ? "streaming" : "ready"}
                disabled={isSending || !input.trim()}
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}

"use client"

/**
 * Chat Page Component
 * Uses AI SDK v5 with custom UI components styled like assistant-ui
 * Follows best practices from https://github.com/vercel/ai-chatbot
 */

import * as React from "react"
import { ThreadList } from "@hubble/ui/blocks"
import {
  Conversation,
  Message,
  PromptInput,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from "@hubble/ui"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ChatService, useChatSidebar } from "@hubble/chat"
import { toast } from "sonner"
import { Separator } from "@hubble/ui"
import { browserLoggers } from "@hubble/logger"

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null)
  const [input, setInput] = React.useState("")
  const queuedMessageRef = React.useRef<string | null>(null)
  const isCreatingConversationRef = React.useRef(false)

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false)
  const [renamingConversationId, setRenamingConversationId] = React.useState<string | null>(null)
  const [renameTitle, setRenameTitle] = React.useState("")

  const {
    conversations,
    currentConversationId,
    selectConversation: selectConv,
    startNewChat: startNew,
    renameConversation,
    archiveConversation,
    loadConversations,
  } = useChatSidebar()

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/v1/chat",
        async prepareSendMessagesRequest({ messages }) {
          return {
            body: {
              messages,
              conversationId: activeConversationId,
            },
          }
        },
      }),
    [activeConversationId],
  )

  const chat = useChat({
    id: activeConversationId || undefined,
    transport,
    onError: (error) => {
      const logger = browserLoggers.chat(activeConversationId || undefined)
      logger.error("Chat error occurred", { error: error.message }, error as Error)
      toast.error("Failed to send message")
    },
    async onFinish({ messages }) {
      // Reload conversations to update sidebar
      await loadConversations()

      // Auto-generate title for new conversations
      if (activeConversationId) {
        const currentConversations = await ChatService.loadConversations()
        const conversation = currentConversations.find((c) => c.id === activeConversationId)

        if (conversation?.title === "New Chat") {
          const firstUserMessage = messages.find((m) => m.role === "user")

          if (firstUserMessage) {
            const messageText = firstUserMessage.parts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("")

            ChatService.autoGenerateTitle(activeConversationId, messageText)
              .then(async () => {
                await loadConversations()
              })
              .catch((error) => {
                const logger = browserLoggers.chat(activeConversationId)
                logger.warn("Failed to auto-generate title", {
                  error: error instanceof Error ? error.message : String(error),
                })
              })
          }
        }
      }
    },
  })

  // Load messages when conversation changes
  React.useEffect(() => {
    const loadMessages = async () => {
      if (!currentConversationId) {
        setActiveConversationId(null)
        chat.setMessages([])
        setInput("")
        return
      }

      // Don't reload if we just created this conversation and have queued a message
      // This prevents clearing the optimistic user message
      if (currentConversationId === activeConversationId && queuedMessageRef.current) {
        return
      }

      setActiveConversationId(currentConversationId)

      try {
        const msgs = await ChatService.loadMessages(currentConversationId)
        const uiMessages: UIMessage[] = msgs.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          parts: [{ type: "text" as const, text: m.text }],
          metadata: m.metadata,
        }))

        chat.setMessages(uiMessages)
        setInput("")
      } catch (_error) {
        toast.error("Failed to load messages")
      }
    }

    loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId, activeConversationId])

  // Send queued message after activeConversationId updates
  React.useEffect(() => {
    if (activeConversationId && queuedMessageRef.current) {
      const messageToSend = queuedMessageRef.current
      queuedMessageRef.current = null

      // Use setTimeout to ensure transport has updated
      setTimeout(() => {
        chat.sendMessage({ text: messageToSend })
        // Reset the creating flag after message is sent
        isCreatingConversationRef.current = false
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim()) return

      const currentInput = input

      // Create conversation if this is a new chat
      if (!activeConversationId) {
        // Prevent multiple conversation creations from rapid Enter presses
        if (isCreatingConversationRef.current) {
          return
        }

        isCreatingConversationRef.current = true

        try {
          const newConv = await ChatService.createConversation("New Chat")

          // Update sidebar immediately
          await loadConversations()
          await selectConv(newConv.id)

          // Set the active conversation ID which will trigger transport update
          setActiveConversationId(newConv.id)

          // Store the message to send after state updates
          // Use a ref to queue the message
          queuedMessageRef.current = currentInput
          setInput("")
        } catch (_error) {
          isCreatingConversationRef.current = false
          toast.error("Failed to create conversation")
          return
        }
      } else {
        // Send message for existing conversation
        chat.sendMessage({ text: currentInput })
        setInput("")
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, activeConversationId, loadConversations, selectConv],
  )

  const handleSelectConversation = React.useCallback(
    async (id: string) => {
      await selectConv(id)
    },
    [selectConv],
  )

  const handleStartNewChat = React.useCallback(async () => {
    setActiveConversationId(null)
    setInput("")
    chat.setMessages([])
    isCreatingConversationRef.current = false
    queuedMessageRef.current = null
    await startNew()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNew])

  const handleRenameConversation = React.useCallback(
    (id: string) => {
      const conversation = conversations.find((c) => c.id === id)
      if (!conversation) return

      setRenamingConversationId(id)
      setRenameTitle(conversation.title)
      setRenameDialogOpen(true)
    },
    [conversations],
  )

  const handleRenameSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!renamingConversationId || !renameTitle.trim()) return

      const conversation = conversations.find((c) => c.id === renamingConversationId)
      if (conversation && renameTitle.trim() !== conversation.title) {
        await renameConversation(renamingConversationId, renameTitle.trim())
      }

      setRenameDialogOpen(false)
      setRenamingConversationId(null)
      setRenameTitle("")
    },
    [renamingConversationId, renameTitle, conversations, renameConversation],
  )

  const handleArchive = React.useCallback(
    async (id: string) => {
      await archiveConversation(id)
    },
    [archiveConversation],
  )

  const threadItems = React.useMemo(
    () =>
      conversations.map((conv) => ({
        id: conv.id,
        title: conv.title,
        isActive: conv.id === currentConversationId,
      })),
    [conversations, currentConversationId],
  )

  return (
    <>
      <div className="flex h-full min-h-0 min-w-0 gap-0">
        <ThreadList
          items={threadItems}
          activeId={currentConversationId}
          onNewThread={handleStartNewChat}
          onSelectThread={handleSelectConversation}
          onRenameThread={handleRenameConversation}
          onArchiveThread={handleArchive}
        />

        <Separator orientation="vertical" />

        <div className="flex flex-1 flex-col min-h-0">
          <Conversation welcome={{ message: "Hello! How can I help you today?" }}>
            {chat.messages.map((message) => {
              const textContent = message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("")

              return (
                <Message
                  key={message.id}
                  from={message.role as "user" | "assistant"}
                  content={textContent}
                />
              )
            })}
          </Conversation>

          <PromptInput
            input={input}
            isLoading={chat.status === "streaming" || chat.status === "submitted"}
            onInputChange={setInput}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>Enter a new title for this conversation.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  placeholder="Conversation title"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

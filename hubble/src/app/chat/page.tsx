"use client"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import * as React from "react"
import { ChatConversation } from "@/components/chat/ChatConversation"
import { PromptInput, PromptInputTextarea, PromptInputToolbar, PromptInputTools, PromptInputSubmit } from "@/components/ai-elements/prompt-input"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { Separator } from "@/components/ui/separator"

export default function Page() {
  const [input, setInput] = React.useState("")
  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  function onSubmit() {
    const trimmed = input.trim()
    if (!trimmed) return
    sendMessage({ text: trimmed })
    setInput("")
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-[calc(100svh-var(--site-header-height))] min-h-0">
        <div className="flex h-full min-h-0 min-w-0 gap-0 pr-0 pt-0">
          <ChatSidebar side="left" />
          <Separator orientation="vertical" />
          <div className="flex-1 flex flex-col">
            <ChatConversation messages={messages} isTyping={status === "submitted" || status === "streaming"} />
            <div className="p-3">
              <PromptInput
                className=""
                onSubmit={(e) => {
                  e.preventDefault()
                  onSubmit()
                }}
              >
                <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  placeholder="Say something..."
                  minRows={2}
                  maxRows={10}
                />
                <PromptInputToolbar>
                  <PromptInputTools />
                  <PromptInputSubmit
                    status={status === "streaming" ? "streaming" : "ready"}
                    disabled={!input.trim()}
                  />
                </PromptInputToolbar>
              </PromptInput>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}



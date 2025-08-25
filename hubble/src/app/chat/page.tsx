"use client"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import * as React from "react"
import { ChatMessageList } from "@/components/chat/ChatMessageList"
import { ChatInput } from "@/components/chat/ChatInput"
import { useChatState } from "@/hooks/useChatState"
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { Separator } from "@/components/ui/separator"

export default function Page() {
  const { messages, input, setInput, isTyping, submit } = useChatState()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-[calc(100svh-var(--site-header-height))] min-h-0">
        <div className="flex h-full min-h-0 min-w-0 gap-0 pr-4 pt-0">
          <ChatSidebar side="left" />
          <Separator orientation="vertical" />
          <div className="bg-muted/50 flex-1 min-h-0 min-w-0 rounded-xl flex flex-col">
            <ChatMessageList messages={messages} isTyping={isTyping} />
            <div className="border-t p-3">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={submit}
                disabled={!input.trim() || isTyping}
              />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}



"use client"

import * as React from "react"
import { ThreadPrimitive, ComposerPrimitive, MessagePrimitive } from "@assistant-ui/react"
import { Send } from "lucide-react"
import { cn } from "../../lib/utils"

export interface ThreadProps {
  className?: string
  welcome?: {
    message?: string
  }
}

export function Thread({ className, welcome }: ThreadProps) {
  return (
    <ThreadPrimitive.Root className={cn("flex h-full flex-col", className)}>
      {/* Messages */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 pb-4">
        <ThreadPrimitive.Empty>
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">
              {welcome?.message || "Start a conversation..."}
            </p>
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage: () => (
              <MessagePrimitive.Root className="mb-4">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground max-w-[80%] rounded-lg px-4 py-2">
                    <MessagePrimitive.Content />
                  </div>
                </div>
              </MessagePrimitive.Root>
            ),
            AssistantMessage: () => (
              <MessagePrimitive.Root className="mb-4">
                <div className="flex justify-start">
                  <div className="prose prose-sm dark:prose-invert max-w-[80%] rounded-lg px-4 py-2">
                    <MessagePrimitive.Content />
                  </div>
                </div>
              </MessagePrimitive.Root>
            ),
          }}
        />
      </ThreadPrimitive.Viewport>

      {/* Composer */}
      <div className="border-t p-4">
        <ComposerPrimitive.Root className="border-input focus-within:ring-ring flex items-center gap-2 rounded-lg border focus-within:ring-2">
          <ComposerPrimitive.Input
            className="placeholder:text-muted-foreground flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none"
            placeholder="Ask me anything..."
            rows={1}
            autoFocus
          />
          <ComposerPrimitive.Send className="text-muted-foreground hover:text-foreground mr-2 transition-colors">
            <Send className="h-5 w-5" />
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>

      {/* Scroll to bottom */}
      <ThreadPrimitive.ScrollToBottom />
    </ThreadPrimitive.Root>
  )
}

Thread.displayName = "Thread"

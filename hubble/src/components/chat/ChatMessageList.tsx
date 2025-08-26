"use client"

import * as React from "react"
import { ChatMessage } from "@/components/chat/ChatMessage"
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { useHydrated } from "@/hooks/useHydrated"

export function ChatMessageList({
  messages,
  isTyping,
}: {
  messages: UIMessage[]
  isTyping: boolean
}) {
  const endRef = React.useRef<HTMLDivElement | null>(null)
  const hydrated = useHydrated()
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  function textFromParts(parts: UIMessagePart<UIDataTypes, UITools>[]): string {
    return parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .filter(Boolean)
      .join("")
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      {!hydrated && (
        <div ref={endRef} />
      )}
      {hydrated && (
        <>
      {messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => (
          <ChatMessage key={m.id} role={m.role as "user" | "assistant"} content={textFromParts(m.parts)} />
        ))}

      {isTyping && (
        <div className="flex items-start gap-3">
          <Avatar className="size-7">
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div className="bg-muted rounded-md px-3 py-2 max-w-[75%]">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Typing…
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />
        </>
      )}
    </div>
  )
}



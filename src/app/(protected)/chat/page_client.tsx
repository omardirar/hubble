"use client"

import * as React from "react"
import { ChatConversation } from "@/components/chat/ChatConversation"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input"
async function sendChat(text: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) return ""
  const data = (await res.json().catch(() => ({}))) as { reply?: string }
  return data.reply ?? ""
}
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { Separator } from "@/components/ui/separator"

export default function ClientChatPage() {
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<
    Array<{ id: string; role: "user" | "assistant"; text: string }>
  >([])
  const [status, setStatus] = React.useState<"idle" | "streaming">("idle")

  async function onSubmit() {
    const trimmed = input.trim()
    if (!trimmed) return
    const id = `${Date.now()}`
    setMessages((prev) => [...prev, { id, role: "user", text: trimmed }])
    setInput("")
    setStatus("streaming")
    const reply = await sendChat(trimmed)
    setMessages((prev) => [
      ...prev,
      { id: `${id}-r`, role: "assistant", text: reply || "(no reply)" },
    ])
    setStatus("idle")
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 gap-0 pt-0 pr-0">
      <ChatSidebar side="left" />
      <Separator orientation="vertical" />
      <div className="flex flex-1 flex-col">
        <ChatConversation messages={messages} isTyping={status === "streaming"} />
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
  )
}

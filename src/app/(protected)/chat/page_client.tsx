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
import { toast } from "sonner"

export default function ClientChatPage() {
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<
    Array<{ id: string; role: "user" | "assistant"; text: string }>
  >([])
  const [status, setStatus] = React.useState<"idle" | "streaming">("idle")
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = React.useState(0)
  const [, setDraftStatus] = React.useState<"empty" | "creating" | "ready">("empty")

  React.useEffect(() => {
    if (!conversationId) return
    let alive = true
    fetch(`/api/messages/${conversationId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text().catch(() => r.statusText))
        return r.json()
      })
      .then((rows: Array<{ id: string; role: "user" | "assistant" | "system"; text: string }>) => {
        if (!alive) return
        // TODO: in future, support "Load Older Messages" button
        // that prepends older ones to this list
        const filtered = rows.filter(
          (m): m is { id: string; role: "user" | "assistant"; text: string } =>
            m.role === "user" || m.role === "assistant",
        )
        setMessages(filtered)
      })
      .catch((e: unknown) => {
        console.error(e)
        const status =
          typeof e === "object" && e !== null && "status" in e
            ? (e as { status?: number }).status
            : undefined
        if (status === 401 || status === 403) {
          toast.error("Check you're signed in and in the correct workspace.")
        }
      })
    return () => {
      alive = false
    }
  }, [conversationId])

  async function onSubmit() {
    const trimmed = input.trim()
    if (!trimmed) return
    // Ensure we have a conversation; create if missing
    let targetConversationId = conversationId
    if (!targetConversationId) {
      setDraftStatus("creating")
      const tsTitle = Math.floor(Date.now() / 1000).toString()
      // TODO: Generate AI title after first assistant reply and update conversation.title
      const r = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: tsTitle }),
      })
      if (r.ok) {
        const c = (await r.json()) as { id: string }
        targetConversationId = c.id
        setConversationId(c.id)
        setDraftStatus("ready")
        console.log("conversation_created", { id: c.id })
      } else {
        toast.error("Failed to start a new conversation")
        setDraftStatus("empty")
        return
      }
    }

    const id = `${Date.now()}`
    // Optimistic UI: show pending user message
    setMessages((prev) => [...prev, { id, role: "user", text: trimmed }])
    setStatus("streaming")

    // Persist user message (idempotent). Only clear input on success
    try {
      const idem = crypto?.randomUUID?.() ?? `${Date.now()}`
      const res = await fetch(`/api/messages/${targetConversationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "user", text: trimmed, idempotencyKey: idem }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => "Failed to send message")
        toast.error(msg)
      } else {
        setInput("")
        console.log("message_sent", { conversationId: targetConversationId })
        // Refresh message list to ensure canonical order and sidebar recents
        try {
          const r = await fetch(`/api/messages/${targetConversationId}`)
          if (r.ok) {
            const rows = (await r.json()) as Array<{
              id: string
              role: "user" | "assistant" | "system"
              text: string
            }>
            const filtered = rows.filter(
              (m): m is { id: string; role: "user" | "assistant"; text: string } =>
                m.role === "user" || m.role === "assistant",
            )
            setMessages(filtered)
          }
        } catch {}
        // Refresh sidebar so active conversation jumps to the top
        setSidebarRefreshKey((k) => k + 1)
        console.log("sidebar_refreshed")
      }
    } catch (e) {
      console.error(e)
      toast.error("Failed to send message")
    }
    const reply = await sendChat(trimmed)
    setMessages((prev) => [
      ...prev,
      { id: `${id}-r`, role: "assistant", text: reply || "(no reply)" },
    ])
    if (reply && reply.trim()) {
      try {
        const idem2 = crypto?.randomUUID?.() ?? `${Date.now()}-r`
        await fetch(`/api/messages/${targetConversationId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role: "assistant", text: reply, idempotencyKey: idem2 }),
        })
      } catch (e) {
        console.error(e)
      }
    }
    setStatus("idle")
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 gap-0 pt-0 pr-0">
      <ChatSidebar
        side="left"
        refreshKey={sidebarRefreshKey}
        activeId={conversationId}
        onSelectChat={(id) => setConversationId(id)}
        onNewChat={() => {
          // Enter draft mode: no conversation yet; clear current thread
          setConversationId(null)
          setMessages([])
          setDraftStatus("empty")
        }}
      />
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
              autoFocus
            />
            <PromptInputToolbar>
              <PromptInputTools />
              <PromptInputSubmit
                status={status === "streaming" ? "streaming" : "ready"}
                disabled={status === "streaming" || !input.trim()}
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}

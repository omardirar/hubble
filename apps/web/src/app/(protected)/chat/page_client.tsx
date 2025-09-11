"use client"

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
import { toast } from "sonner"
import { apiFetch, generateId, loadMessages } from "@hubble/utils"
import { useChatList } from "@hubble/ui"
async function sendChat(text: string): Promise<string> {
  try {
    const res = await apiFetch("/api/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
    const data = (await res.json().catch(() => ({}))) as { reply?: string }
    return data.reply ?? ""
  } catch {
    return ""
  }
}
// TODO: Expand test coverage for useChatState and related components
//   Context: Add unit tests for optimistic updates, sidebar refresh logic, and error paths.
//   labels: area/web, feature/chat, type/tests
//   assignees: omzification
//   milestone: 0.0.1

export default function ClientChatPage() {
  const { sessions } = useChatList()
  const [serverConversations, setServerConversations] = React.useState<
    Array<{ id: string; title: string; updated_at?: string }>
  >([])
  const [isSidebarLoading, setIsSidebarLoading] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<
    Array<{ id: string; role: "user" | "assistant"; text: string }>
  >([])
  const [status, setStatus] = React.useState<"idle" | "streaming">("idle")
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = React.useState(0)
  const [, setDraftStatus] = React.useState<"empty" | "creating" | "ready">("empty")

  // TODO: Persist input drafts per conversation
  //   Context: Store unsent message drafts in localStorage keyed by conversation id for resilience.
  //   labels: area/web, feature/chat, type/enhancement
  //   assignees: omzification
  //   milestone: 0.0.1

  const loadMessagesCallback = React.useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const filtered = await loadMessages(id, signal)
      setMessages(filtered)
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return
      console.error(e)
      const status =
        typeof e === "object" && e !== null && "status" in e
          ? (e as { status?: number }).status
          : undefined
      if (status === 401 || status === 403) {
        toast.error("Check you're signed in and in the correct workspace.")
      }
    }
  }, [])

  React.useEffect(() => {
    // Load conversations for sidebar
    setIsSidebarLoading(true)
    let alive = true
    const t = setTimeout(() => {
      apiFetch("/api/v1/chat/conversations")
        .then((r) => r.json())
        .then((rows) => {
          if (!alive) return
          setServerConversations(rows)
        })
        .catch((e) => {
          toast.error("Failed to load conversations")
          console.error(e)
        })
        .finally(() => setIsSidebarLoading(false))
    }, 120)

    // Load messages for active conversation
    if (conversationId) {
      const controller = new AbortController()
      loadMessagesCallback(conversationId, controller.signal)
      return () => {
        alive = false
        clearTimeout(t)
        controller.abort()
      }
    }

    return () => {
      alive = false
      clearTimeout(t)
    }
    // TODO: Add pagination or "load older" for long threads
    //   Context: Implement cursor-based fetching and UI affordance to load older messages efficiently.
    //   labels: area/web, feature/chat, type/enhancement
    //   assignees: omzification
    //   milestone: 0.0.1
  }, [conversationId, loadMessagesCallback, sidebarRefreshKey])

  async function onSubmit() {
    const trimmed = input.trim()
    if (!trimmed) return
    // Ensure we have a conversation; create if missing
    let targetConversationId = conversationId
    if (!targetConversationId) {
      setDraftStatus("creating")
      const tsTitle = Math.floor(Date.now() / 1000).toString()
      // TODO: Generate AI title after first assistant reply
      //   Context: Use first assistant response to propose a concise conversation title; PATCH endpoint.
      //   labels: area/web, feature/chat, type/enhancement
      //   assignees: omzification
      //   milestone: 0.0.1
      try {
        const r = await apiFetch("/api/v1/chat/conversations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: tsTitle }),
        })
        const c = (await r.json()) as { id: string }
        targetConversationId = c.id
        setConversationId(c.id)
        setDraftStatus("ready")
        console.log("conversation_created", { id: c.id })
      } catch (e) {
        toast.error((e as Error).message || "Failed to start a new conversation")
        setDraftStatus("empty")
        return
      }
    }

    const id = generateId()
    // Optimistic UI: show pending user message
    setMessages((prev) => [...prev, { id, role: "user", text: trimmed }])
    setStatus("streaming")

    // Persist user message (idempotent). Only clear input on success
    try {
      const idem = generateId()
      await apiFetch(`/api/v1/chat/messages/${targetConversationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "user", text: trimmed, idempotencyKey: idem }),
      })
      setInput("")
      console.log("message_sent", { conversationId: targetConversationId })
      await loadMessagesCallback(targetConversationId)
      // Refresh sidebar so active conversation jumps to the top
      setSidebarRefreshKey((k) => k + 1)
      console.log("sidebar_refreshed")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to send message")
    }
    const reply = await sendChat(trimmed)
    // TODO: Stream assistant replies over Server-Sent Events (SSE) for real-time updates
    // Issue URL: https://github.com/omzification/hubble/issues/23
    //   Context: Replace polling with SSE to stream token-by-token AI responses and typing indicators.
    //   labels: area/web, feature/chat, type/enhancement
    //   assignees: omzification
    //   milestone: 0.0.1
    setMessages((prev) => [
      ...prev,
      { id: `${id}-r`, role: "assistant", text: reply || "(no reply)" },
    ])
    if (reply && reply.trim()) {
      try {
        const idem2 = generateId()
        await apiFetch(`/api/v1/chat/messages/${targetConversationId}`, {
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
        activeId={conversationId}
        isLoading={isSidebarLoading}
        items={serverConversations.length ? serverConversations : sessions}
        onSelectChat={(id) => setConversationId(id)}
        onNewChat={() => {
          setConversationId(null)
          setMessages([])
          setDraftStatus("empty")
        }}
        onRename={async (id: string, name: string) => {
          try {
            await apiFetch(`/api/v1/chat/conversations/${id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ title: name }),
            })
            setServerConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, title: name } : c)),
            )
          } catch (e) {
            toast.error("Failed to rename")
            console.error(e)
          }
        }}
        onArchive={async (id: string) => {
          try {
            await apiFetch(`/api/v1/chat/conversations/${id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ archived: true }),
            })
            setServerConversations((prev) => prev.filter((c) => c.id !== id))
          } catch (e) {
            toast.error("Failed to archive")
            console.error(e)
          }
        }}
      />
      <Separator orientation="vertical" />
      <div className="flex flex-1 flex-col">
        <ChatConversation messages={messages} isTyping={status === "streaming"} />
        {/* TODO: Virtualize long message lists for performance */}
        {/*   Context: Use windowing (e.g., react-virtual) to render only visible messages. */}
        {/*   labels: area/web, feature/chat, type/perf */}
        {/*   assignees: omzification */}
        {/*   milestone: 0.0.1 */}
        <div className="p-3">
          <PromptInput
            className=""
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
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

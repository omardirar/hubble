import { apiFetch } from "./fetch"

export type ChatMessage = { id: string; role: "user" | "assistant" | "system"; text: string }

export async function loadMessages(id: string, signal?: AbortSignal) {
  const r = await apiFetch(`/api/v1/chat/messages/${id}`, { signal })
  const rows = (await r.json()) as ChatMessage[]
  return rows.filter(
    (m): m is Omit<ChatMessage, "role"> & { role: "user" | "assistant" } =>
      m.role === "user" || m.role === "assistant",
  )
}

export function contentToText(content: unknown): string {
  if (typeof content === "string") return content
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>
    if ("text" in obj) {
      const v = (obj as { text?: unknown }).text
      return v != null ? String(v) : ""
    }
  }
  return ""
}

// TODO: Add cursor helpers for chat pagination
//   Context: Provide helpers to build next/prev cursors and merge message pages without duplication.
//   labels: area/utils, feature/chat, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

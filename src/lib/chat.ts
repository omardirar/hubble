import { apiFetch } from "./api"

export type ChatMessage = { id: string; role: "user" | "assistant" | "system"; text: string }

export async function loadMessages(id: string, signal?: AbortSignal) {
  // TODO: Replace manual fetch with React Query for caching and retries
  const r = await apiFetch(`/api/chat/messages/${id}`, { signal })
  const rows = (await r.json()) as ChatMessage[]
  return rows.filter(
    (m): m is Omit<ChatMessage, "role"> & { role: "user" | "assistant" } =>
      m.role === "user" || m.role === "assistant",
  )
}

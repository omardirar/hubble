export type ChatMessage = { id: string; role: "user" | "assistant" | "system"; text: string }

export async function loadMessages(id: string, signal?: AbortSignal) {
  // TODO: Replace manual fetch with React Query for caching and retries
  const r = await fetch(`/api/chat/messages/${id}`, { signal })
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText))
  const rows = (await r.json()) as ChatMessage[]
  return rows.filter(
    (m): m is Omit<ChatMessage, "role"> & { role: "user" | "assistant" } =>
      m.role === "user" || m.role === "assistant",
  )
}
